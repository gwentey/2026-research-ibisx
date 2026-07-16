"""Service catalogue : listing, détail, aperçu réel, ingestion, similaires, complétude.

Ingestion = LA porte d'entrée unique (upload ET import Kaggle passent ici —
[NE PAS REPRODUIRE] l'écriture SQL directe du pipeline v1).
"""

import io
import math
import re
import unicodedata
import uuid
from typing import Any

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ibis.core.errors import ConflictError, InvalidInputError, NotFoundError
from ibis.core.logging import get_logger
from ibis.modules.datasets import profiling
from ibis.modules.datasets.ethics import ETHICAL_CRITERIA, ethical_score
from ibis.modules.datasets.filters import apply_filters, apply_sort, count_query
from ibis.modules.datasets.models import Dataset, DatasetColumn, DatasetFile, EthicalTemplate
from ibis.modules.datasets.schemas import (
    CatalogStats,
    CompletionSection,
    CompletionStatus,
    DatasetCard,
    DatasetDetail,
    DatasetFacets,
    DatasetFilters,
    DatasetMetadataInput,
    DatasetMetadataUpdate,
    DatasetPage,
    DatasetPreview,
    FacetValue,
    PreviewColumnStats,
    SimilarDataset,
    SortKey,
    SortOrder,
    UploadAnalysis,
    UploadFileAnalysis,
)
from ibis.storage import get_storage

logger = get_logger(__name__)

PREVIEW_ROWS = 50
PREVIEW_MAX_COLUMNS = 20
RANDOM_STATE = 42  # P4 — reproductibilité


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "_", normalized.lower()).strip("_")
    return slug[:120] or "dataset"


# ------------------------------------ Lecture ------------------------------------------------


def to_card(dataset: Dataset) -> DatasetCard:
    return DatasetCard(
        **{
            field: getattr(dataset, field)
            for field in DatasetCard.model_fields
            if field != "ethical_score"
        },
        ethical_score=ethical_score(dataset.ethical_values()),
    )


def to_detail(dataset: Dataset) -> DatasetDetail:
    completeness = (
        round(100 - dataset.global_missing_percentage, 2)
        if dataset.global_missing_percentage is not None
        else None
    )
    base = {
        field: getattr(dataset, field)
        for field in DatasetDetail.model_fields
        if field not in ("ethical_score", "ethical_criteria", "completeness", "files")
    }
    return DatasetDetail(
        **base,
        ethical_score=ethical_score(dataset.ethical_values()),
        ethical_criteria=dataset.ethical_values(),
        completeness=completeness,
        files=dataset.files,
    )


def list_datasets(
    db: Session,
    filters: DatasetFilters,
    *,
    sort_by: SortKey = "name",
    sort_order: SortOrder = "asc",
    page: int = 1,
    page_size: int = 24,
) -> DatasetPage:
    total = db.scalar(count_query(filters)) or 0
    query = apply_sort(apply_filters(select(Dataset), filters), sort_by, sort_order)
    query = query.offset((page - 1) * page_size).limit(page_size)
    items = [to_card(d) for d in db.scalars(query).all()]
    return DatasetPage(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


def get_dataset(db: Session, dataset_id: uuid.UUID) -> Dataset:
    dataset = db.scalar(
        select(Dataset)
        .options(selectinload(Dataset.files).selectinload(DatasetFile.columns))
        .where(Dataset.id == dataset_id)
    )
    if dataset is None:
        raise NotFoundError("Dataset introuvable", code="DATASET_NOT_FOUND")
    return dataset


def get_facets(db: Session) -> DatasetFacets:
    domain_rows = db.execute(
        select(func.unnest(Dataset.domain).label("v"), func.count())
        .group_by("v")
        .order_by(func.count().desc())
    ).all()
    task_rows = db.execute(
        select(func.unnest(Dataset.task).label("v"), func.count())
        .group_by("v")
        .order_by(func.count().desc())
    ).all()
    bounds = db.execute(
        select(
            func.coalesce(func.max(Dataset.instances_number), 0),
            func.coalesce(func.max(Dataset.features_number), 0),
            func.coalesce(func.min(Dataset.year), 2000),
            func.coalesce(func.max(Dataset.year), 2026),
            func.coalesce(func.max(Dataset.num_citations), 0),
        )
    ).one()
    return DatasetFacets(
        domains=[FacetValue(value=v, count=c) for v, c in domain_rows],
        tasks=[FacetValue(value=v, count=c) for v, c in task_rows],
        instances_max=bounds[0],
        features_max=bounds[1],
        year_min=bounds[2],
        year_max=bounds[3],
        citations_max=bounds[4],
    )


def get_stats(db: Session) -> CatalogStats:
    totals = db.execute(
        select(
            func.count(Dataset.id),
            func.coalesce(func.sum(Dataset.instances_number), 0),
            func.avg(Dataset.features_number),
        )
    ).one()
    facets = get_facets(db)
    return CatalogStats(
        total_datasets=totals[0],
        total_instances=int(totals[1]),
        average_features=round(float(totals[2]), 1) if totals[2] is not None else None,
        domain_distribution=facets.domains,
        task_distribution=facets.tasks,
    )


# ------------------------------------ Aperçu réel --------------------------------------------


def load_file_dataframe(file: DatasetFile) -> pd.DataFrame:
    """Charge le Parquet depuis le stockage — échec EXPLICITE si indisponible (P1)."""
    storage = get_storage()
    if not storage.exists(file.storage_key):
        raise NotFoundError(
            f"Fichier de données indisponible dans le stockage ({file.original_filename})",
            code="DATASET_FILE_UNAVAILABLE",
        )
    with storage.open(file.storage_key) as fh:
        return pd.read_parquet(io.BytesIO(fh.read()))


def preview_dataset(
    db: Session, dataset_id: uuid.UUID, *, columns: list[str] | None = None
) -> DatasetPreview:
    dataset = get_dataset(db, dataset_id)
    if not dataset.files:
        raise NotFoundError("Ce dataset n'a aucun fichier de données", code="DATASET_NO_FILE")
    file = dataset.files[0]
    df = load_file_dataframe(file)

    sampled = len(df) > PREVIEW_ROWS
    sample = df.sample(n=PREVIEW_ROWS, random_state=RANDOM_STATE) if sampled else df
    sample = sample.sort_index()

    available = [str(c) for c in df.columns]
    if columns:
        displayed = [c for c in columns if c in available][:PREVIEW_MAX_COLUMNS]
        if not displayed:
            displayed = available[:PREVIEW_MAX_COLUMNS]
    else:
        displayed = available[:PREVIEW_MAX_COLUMNS]

    rows = [
        {k: profiling.sanitize_json(v) for k, v in record.items()}
        for record in sample[displayed]
        .astype(object)
        .where(pd.notna(sample[displayed]), None)
        .to_dict(orient="records")
    ]
    column_stats = [
        PreviewColumnStats(name=c.name, dtype_interpreted=c.dtype_interpreted, stats=c.stats)
        for c in file.columns
        if c.name in displayed
    ]
    return DatasetPreview(
        file_id=file.id,
        original_filename=file.original_filename,
        total_rows=file.row_count,
        total_columns=len(available),
        displayed_columns=displayed,
        rows=rows,
        column_stats=column_stats,
        sampled=sampled,
        random_state=RANDOM_STATE,
    )


# ------------------------------------ Similaires ---------------------------------------------


def similar_datasets(db: Session, dataset: Dataset, *, limit: int = 5) -> list[SimilarDataset]:
    """Même domaine+tâche > domaine > tâche > taille ±50 % (CDC §5.4)."""
    candidates = db.scalars(select(Dataset).where(Dataset.id != dataset.id)).all()
    results: list[tuple[int, str, Dataset]] = []
    size = dataset.instances_number or 0
    for candidate in candidates:
        shares_domain = bool(set(candidate.domain) & set(dataset.domain))
        shares_task = bool(set(candidate.task) & set(dataset.task))
        close_size = (
            size > 0
            and candidate.instances_number is not None
            and 0.5 * size <= candidate.instances_number <= 1.5 * size
        )
        if shares_domain and shares_task:
            results.append((0, "domain_and_task", candidate))
        elif shares_domain:
            results.append((1, "domain", candidate))
        elif shares_task:
            results.append((2, "task", candidate))
        elif close_size:
            results.append((3, "size", candidate))
    results.sort(key=lambda item: (item[0], -(item[2].num_citations or 0)))
    return [
        SimilarDataset(dataset=to_card(candidate), reason=reason)
        for _, reason, candidate in results[:limit]
    ]


# ------------------------------------ Ingestion ----------------------------------------------


def analyze_upload(files: list[tuple[str, bytes]]) -> UploadAnalysis:
    """Analyse pré-upload SANS persistance (CDC §5.5.b)."""
    if not files:
        raise InvalidInputError("Aucun fichier fourni", code="NO_FILE")
    analyses: list[UploadFileAnalysis] = []
    all_columns: list[str] = []
    first_profile: profiling.FileProfile | None = None
    for filename, content in files:
        df = profiling.read_dataframe(content, filename)
        profile = profiling.profile_dataframe(df)
        first_profile = first_profile or profile
        all_columns.extend(c.name for c in profile.columns)
        preview_rows = [
            {k: profiling.sanitize_json(v) for k, v in record.items()}
            for record in df.head(10)
            .astype(object)
            .where(pd.notna(df.head(10)), None)
            .to_dict(orient="records")
        ]
        analyses.append(
            UploadFileAnalysis(
                original_filename=filename,
                row_count=profile.row_count,
                column_count=profile.column_count,
                missing_percentage=profile.missing_percentage,
                columns=[
                    {
                        "name": c.name,
                        "dtype_interpreted": c.dtype_interpreted,
                        "is_pii": c.is_pii,
                        "null_percentage": c.stats.get("null_percentage", 0),
                    }
                    for c in profile.columns
                ],
                preview_rows=preview_rows,
            )
        )
    assert first_profile is not None
    suggested_name = files[0][0].rsplit(".", 1)[0].replace("_", " ").replace("-", " ").title()
    return UploadAnalysis(
        files=analyses,
        suggested_name=suggested_name[:255],
        suggested_domains=profiling.suggest_domains(all_columns),
        suggested_tasks=profiling.suggest_tasks(first_profile),
        indicative_quality_score=profiling.indicative_quality_score(first_profile),
    )


def template_defaults_for_domains(db: Session, domains: list[str]) -> dict[str, Any]:
    """Template éthique du 1er domaine correspondant, sinon `default`, sinon rien (M8)."""
    for candidate in [*domains, "default"]:
        template = db.scalar(select(EthicalTemplate).where(EthicalTemplate.domain == candidate))
        if template is not None:
            return dict(template.defaults)
    return {}


def create_dataset(
    db: Session,
    *,
    metadata: DatasetMetadataInput,
    files: list[tuple[str, bytes]],
    owner_id: uuid.UUID | None,
    apply_ethical_template: bool = False,
) -> Dataset:
    if not files:
        raise InvalidInputError("Au moins un fichier de données est requis", code="NO_FILE")

    slug = metadata.dataset_name or slugify(metadata.display_name)
    if db.scalar(select(Dataset.id).where(Dataset.dataset_name == slug)):
        raise ConflictError(f"Un dataset '{slug}' existe déjà", code="DATASET_EXISTS")

    payload = metadata.model_dump(exclude={"dataset_name"})
    if apply_ethical_template:
        defaults = template_defaults_for_domains(db, metadata.domain)
        for key, value in defaults.items():
            if key in payload and payload[key] is None:
                payload[key] = value

    dataset = Dataset(dataset_name=slug, created_by=owner_id, **payload)
    db.add(dataset)
    db.flush()  # id disponible pour les clés de stockage

    storage = get_storage()
    total_rows = 0
    max_columns = 0
    weighted_missing = 0.0
    any_missing = False
    stored_keys: list[str] = []

    try:
        for original_filename, content in files:
            df = profiling.read_dataframe(content, original_filename)
            profile = profiling.profile_dataframe(df)

            buffer = io.BytesIO()
            df.to_parquet(buffer, compression="snappy", index=False)
            buffer.seek(0)
            storage_key = f"datasets/{dataset.id}/{uuid.uuid4()}.parquet"
            size = storage.save(storage_key, buffer)
            stored_keys.append(storage_key)

            role = "data_file"
            lowered = original_filename.lower()
            if "train" in lowered:
                role = "training_data"
            elif "test" in lowered:
                role = "test_data"

            file_row = DatasetFile(
                dataset_id=dataset.id,
                original_filename=original_filename[:255],
                storage_key=storage_key,
                logical_role=role,
                format="parquet",
                size_bytes=size,
                row_count=profile.row_count,
            )
            db.add(file_row)
            db.flush()
            for column in profile.columns:
                db.add(
                    DatasetColumn(
                        file_id=file_row.id,
                        name=column.name,
                        dtype_original=column.dtype_original,
                        dtype_interpreted=column.dtype_interpreted,
                        is_nullable=column.is_nullable,
                        is_pii=column.is_pii,
                        example_values=column.example_values,
                        position=column.position,
                        stats=column.stats,
                    )
                )

            total_rows = max(total_rows, profile.row_count)
            max_columns = max(max_columns, profile.column_count)
            weighted_missing += profile.missing_percentage * profile.row_count
            any_missing = any_missing or profile.missing_percentage > 0

        # Agrégats calculés (CDC §5.5) — pondération par lignes
        dataset.instances_number = total_rows
        dataset.features_number = max_columns
        total_row_sum = sum(f.row_count for f in dataset.files) or 1
        dataset.global_missing_percentage = round(weighted_missing / total_row_sum, 2)
        dataset.has_missing_values = any_missing
        db.commit()
    except Exception:
        db.rollback()
        for key in stored_keys:  # nettoyage des artefacts partiels
            storage.delete(key)
        raise

    db.refresh(dataset)
    logger.info("dataset.created", dataset_id=str(dataset.id), slug=slug, files=len(files))
    return get_dataset(db, dataset.id)


def update_dataset(db: Session, dataset: Dataset, payload: DatasetMetadataUpdate) -> Dataset:
    for field, value in payload.model_dump(exclude_unset=True, exclude={"dataset_name"}).items():
        setattr(dataset, field, value)
    db.commit()
    return get_dataset(db, dataset.id)


def delete_dataset(db: Session, dataset: Dataset) -> None:
    storage = get_storage()
    keys = [f.storage_key for f in dataset.files]
    db.delete(dataset)
    db.commit()
    for key in keys:
        storage.delete(key)
    logger.info("dataset.deleted", dataset_id=str(dataset.id))


# ------------------------------------ Complétude ---------------------------------------------

GENERAL_FIELDS = (
    "display_name",
    "year",
    "objective",
    "sources",
    "storage_uri",
    "documentation_link",
    "citation_link",
    "availability",
)
TECHNICAL_FIELDS = (
    "instances_number",
    "features_number",
    "features_description",
    "domain",
    "task",
    "split",
    "temporal_factors",
    "has_missing_values",
    "representativity_level",
    "sample_balance_level",
    "metadata_provided_with_dataset",
    "external_documentation_available",
)
NEEDS_HUMAN_REVIEW = ("informed_consent", "anonymization_applied", "equity_non_discrimination")


def completion_status(dataset: Dataset) -> CompletionStatus:
    def is_filled(value: Any) -> bool:
        if value is None:
            return False
        return not (isinstance(value, (list, str)) and len(value) == 0)

    sections: list[CompletionSection] = []
    total_filled = 0
    total_fields = 0
    for name, fields in (
        ("general", GENERAL_FIELDS),
        ("technical", TECHNICAL_FIELDS),
        ("ethical", ETHICAL_CRITERIA),
    ):
        missing = [f for f in fields if not is_filled(getattr(dataset, f))]
        filled = len(fields) - len(missing)
        sections.append(
            CompletionSection(
                name=name,
                filled=filled,
                total=len(fields),
                missing_fields=missing,
            )
        )
        total_filled += filled
        total_fields += len(fields)

    return CompletionStatus(
        overall_percentage=round(total_filled / total_fields * 100),
        sections=sections,
        needs_human_review=[f for f in NEEDS_HUMAN_REVIEW if getattr(dataset, f) is None],
    )
