"""Import de datasets par configuration YAML (CDC §5.5.a).

Chaque entrée passe par la MÊME couche service que l'upload
([NE PAS REPRODUIRE] l'écriture SQL directe du pipeline Kaggle v1).
Idempotent : un slug déjà présent est ignoré (relançable sans effet de bord).
"""

import json
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import yaml
from pydantic import ValidationError
from sqlalchemy.orm import Session

from ibis.core.config import get_settings
from ibis.core.errors import InvalidInputError
from ibis.core.logging import get_logger
from ibis.modules.datasets import service
from ibis.modules.datasets.schemas import DatasetMetadataInput

logger = get_logger(__name__)


@dataclass
class ImportReport:
    imported: list[str]
    skipped: list[str]
    failed: list[tuple[str, str]]

    @property
    def summary(self) -> str:
        return (
            f"{len(self.imported)} importé(s), {len(self.skipped)} ignoré(s) (déjà présents), "
            f"{len(self.failed)} en échec"
        )


def load_enriched_metadata(path: Path) -> DatasetMetadataInput:
    """Métadonnées enrichies validées par le schéma strict (extra=forbid)."""
    try:
        raw = json.loads(path.read_text())
        return DatasetMetadataInput.model_validate(raw)
    except (json.JSONDecodeError, OSError) as exc:
        raise InvalidInputError(f"Métadonnées illisibles ({path.name}) : {exc}") from exc
    except ValidationError as exc:
        first = exc.errors()[0]
        raise InvalidInputError(
            f"Métadonnées invalides ({path.name}) : {first['loc']} — {first['msg']}"
        ) from exc


def fetch_kaggle_files(kaggle_ref: str) -> list[tuple[str, bytes]]:
    """Téléchargement Kaggle via la CLI officielle — nécessite KAGGLE_USERNAME/KAGGLE_KEY."""
    settings = get_settings()
    if not settings.kaggle_username or not settings.kaggle_key:
        raise InvalidInputError(
            f"KAGGLE_USERNAME/KAGGLE_KEY absents : impossible de télécharger {kaggle_ref}. "
            "Les datasets embarqués (local_file) restent importables sans clé."
        )
    with tempfile.TemporaryDirectory() as tmp:
        result = subprocess.run(
            ["kaggle", "datasets", "download", "-d", kaggle_ref, "-p", tmp, "--unzip"],
            capture_output=True,
            text=True,
            timeout=600,
            env={
                "KAGGLE_USERNAME": settings.kaggle_username,
                "KAGGLE_KEY": settings.kaggle_key,
                "PATH": "/usr/local/bin:/usr/bin:/bin",
            },
        )
        if result.returncode != 0:
            # Échec VISIBLE — [NE PAS REPRODUIRE] le `return False` silencieux (S4 v1)
            raise InvalidInputError(f"Échec kaggle download {kaggle_ref} : {result.stderr[:400]}")
        files = sorted(Path(tmp).glob("*.csv"))
        if not files:
            raise InvalidInputError(f"Aucun CSV dans l'archive Kaggle {kaggle_ref}")
        return [(f.name, f.read_bytes()) for f in files]


def import_from_config(
    db: Session,
    config_path: Path,
    *,
    only: list[str] | None = None,
    force: bool = False,
    local_only: bool = False,
) -> ImportReport:
    config = yaml.safe_load(config_path.read_text())
    base_dir = config_path.parent
    report = ImportReport(imported=[], skipped=[], failed=[])

    for entry in config.get("datasets", []):
        slug = entry["slug"]
        if only and slug not in only:
            continue
        if local_only and not entry.get("local_file"):
            continue  # seed sans clé Kaggle : uniquement les fichiers embarqués (CDC §12.5)
        try:
            from sqlalchemy import select

            from ibis.modules.datasets.models import Dataset

            existing = db.scalar(select(Dataset).where(Dataset.dataset_name == slug))
            if existing is not None:
                if not force:
                    report.skipped.append(slug)
                    continue
                service.delete_dataset(db, service.get_dataset(db, existing.id))

            metadata = load_enriched_metadata(base_dir / entry["enriched"])
            metadata.dataset_name = slug

            if entry.get("local_file"):
                path = base_dir / entry["local_file"]
                files = [(path.name, path.read_bytes())]
            elif entry.get("kaggle_ref"):
                files = fetch_kaggle_files(entry["kaggle_ref"])
            else:
                raise InvalidInputError(f"Entrée {slug} : ni local_file ni kaggle_ref")

            service.create_dataset(
                db,
                metadata=metadata,
                files=files,
                owner_id=None,  # import système (created_by NULL)
                apply_ethical_template=True,
            )
            report.imported.append(slug)
            logger.info("import.dataset_done", slug=slug)
        except Exception as exc:  # échec par entrée, l'import continue (et se voit)
            logger.exception("import.dataset_failed", slug=slug)
            report.failed.append((slug, str(exc)))

    return report


def default_config_path() -> Path:
    return Path(__file__).resolve().parents[3] / "seed_data" / "datasets.yaml"
