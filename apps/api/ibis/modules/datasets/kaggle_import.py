"""Import d'un dataset Kaggle à partir d'un lien collé.

Découpage : la route valide et déduplique de façon SYNCHRONE (réponse immédiate et utile),
le téléchargement et l'enrichissement partent au worker (file `maintenance`).
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ibis.core.config import get_settings
from ibis.core.logging import get_logger
from ibis.modules.datasets import enrichment
from ibis.modules.datasets.kaggle_client import KaggleClient, KaggleRef, parse_kaggle_url
from ibis.modules.datasets.models import Dataset
from ibis.modules.datasets.profiling import profile_dataframe, read_dataframe
from ibis.modules.datasets.service import create_dataset, slugify

logger = get_logger(__name__)

SOURCE_KIND = "kaggle"


def source_ref_for(ref: KaggleRef) -> str:
    return f"kaggle:{ref.ref}"


@dataclass
class ImportTicket:
    """Ce que la route renvoie tout de suite."""

    ref: KaggleRef
    #: Renseigné quand le jeu existe déjà : on renvoie l'existant au lieu d'un doublon.
    existing_dataset_id: uuid.UUID | None = None
    duplicate_reason: str | None = None


def find_existing(db: Session, ref: KaggleRef, *, user_id: uuid.UUID | None) -> Dataset | None:
    """Doublon = même jeu Kaggle déjà PUBLIC, ou déjà importé par cette personne.

    On ne révèle jamais la copie privée de quelqu'un d'autre.
    """
    source_ref = source_ref_for(ref)
    public = db.scalar(
        select(Dataset).where(Dataset.source_ref == source_ref, Dataset.access == "public")
    )
    if public is not None:
        return public
    if user_id is None:
        return None
    return db.scalar(
        select(Dataset).where(
            Dataset.source_ref == source_ref,
            Dataset.created_by == user_id,
        )
    )


def unique_slug(db: Session, base: str) -> str:
    """Le slug du catalogue est unique : deux jeux Kaggle homonymes doivent coexister."""
    candidate = slugify(base)[:110] or "dataset"
    if db.scalar(select(Dataset.id).where(Dataset.dataset_name == candidate)) is None:
        return candidate
    for suffix in range(2, 100):
        variant = f"{candidate}-{suffix}"
        if db.scalar(select(Dataset.id).where(Dataset.dataset_name == variant)) is None:
            return variant
    return f"{candidate}-{uuid.uuid4().hex[:8]}"


def prepare(db: Session, *, url: str, user_id: uuid.UUID | None) -> ImportTicket:
    """Validation synchrone : lien lisible, pas déjà présent. Aucun réseau ici."""
    ref = parse_kaggle_url(url)
    existing = find_existing(db, ref, user_id=user_id)
    if existing is not None:
        reason = (
            "Ce dataset est déjà dans le catalogue public."
            if existing.access == "public"
            else "Tu as déjà importé ce dataset."
        )
        return ImportTicket(ref=ref, existing_dataset_id=existing.id, duplicate_reason=reason)
    return ImportTicket(ref=ref)


def run_import(
    db: Session,
    *,
    ref: KaggleRef,
    access_requested: str,
    user_id: uuid.UUID | None,
    client: KaggleClient | None = None,
) -> Dataset:
    """Téléchargement + enrichissement + création. Appelé par le worker.

    `client` est injectable pour les tests — sinon construit depuis la configuration.
    """
    settings = get_settings()
    max_bytes = settings.kaggle_max_dataset_mb * 1024 * 1024
    owned_client = client is None
    kaggle = client or _client_from_settings()

    try:
        meta = kaggle.view(ref)
        kaggle.ensure_within_size_cap(meta, max_bytes=max_bytes)
        files = kaggle.download(ref, max_bytes=max_bytes)
    finally:
        if owned_client:
            kaggle.close()

    # Le profilage porte sur le fichier principal (le plus gros) — même logique que l'upload.
    main_name, main_bytes = max(files, key=lambda item: len(item[1]))
    profile = profile_dataframe(read_dataframe(main_bytes, main_name))

    result = enrichment.enrich(ref, meta, profile, access_requested=access_requested)
    metadata = result.metadata
    metadata.dataset_name = unique_slug(db, ref.slug)

    dataset = create_dataset(
        db,
        metadata=metadata,
        files=files,
        owner_id=user_id,
        # PAS de template éthique : il pré-remplirait les 10 critères par domaine, exactement
        # ce qu'on refuse ici. Les critères restent NULL jusqu'à validation humaine.
        apply_ethical_template=False,
    )

    dataset.source_kind = SOURCE_KIND
    dataset.source_ref = source_ref_for(ref)
    dataset.license_name = meta.license_name
    dataset.is_verified = False  # import communautaire — jamais le badge vérifié
    if result.ethics_suggestions is not None:
        dataset.ethics_suggestions = result.ethics_suggestions
    db.commit()
    db.refresh(dataset)

    logger.info(
        "kaggle.import_done",
        ref=ref.ref,
        dataset_id=str(dataset.id),
        access=dataset.access,
        license_forced_private=result.license_forced_private,
    )
    return dataset


def _client_from_settings() -> KaggleClient:
    from ibis.modules.datasets.kaggle_client import client_from_settings

    return client_from_settings()
