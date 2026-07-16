"""Abstraction de stockage fichiers (ADR-005) — LocalFS par défaut, S3 optionnel."""

from functools import lru_cache

from ibis.core.config import get_settings
from ibis.storage.base import Storage
from ibis.storage.local import LocalFSStorage


@lru_cache
def get_storage() -> Storage:
    settings = get_settings()
    if settings.storage_backend == "local":
        return LocalFSStorage(settings.data_dir)
    raise NotImplementedError(
        "STORAGE_BACKEND=s3 sera activable via un driver boto3-compatible (ADR-005) ; "
        "la v2 démarre volontairement sans MinIO."
    )
