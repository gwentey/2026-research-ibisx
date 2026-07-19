"""Routes /datasets (CDC §5.6) — chaque écriture vérifie rôle + ownership (CDC §3.2)."""

import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session

from ibis.core.config import get_settings
from ibis.core.errors import InvalidInputError, NotFoundError
from ibis.db.engine import get_db
from ibis.modules.auth.deps import CurrentClaims, require_owner_or_admin, require_role
from ibis.modules.auth.models import UserRole
from ibis.modules.datasets import kaggle_import, service
from ibis.modules.datasets.schemas import (
    AiGuideJob,
    CatalogStats,
    CompletionStatus,
    DatasetDetail,
    DatasetFacets,
    DatasetListQuery,
    DatasetMetadataInput,
    DatasetMetadataUpdate,
    DatasetPage,
    DatasetPreview,
    EthicsReviewInput,
    FileRead,
    KaggleImportRequest,
    KaggleImportResponse,
    SimilarDataset,
    UploadAnalysis,
)
from ibis.modules.jobs import service as jobs_service
from ibis.modules.jobs.models import JobKind
from ibis.modules.jobs.schemas import JobRead
from ibis.workers.tasks.kaggle import import_kaggle_dataset as import_kaggle_task

router = APIRouter(prefix="/datasets", tags=["datasets"])

DbDep = Annotated[Session, Depends(get_db)]
ContributorDep = Depends(require_role(UserRole.contributor))

MAX_UPLOAD_FILES = 10


async def read_upload_files(files: list[UploadFile]) -> list[tuple[str, bytes]]:
    settings = get_settings()
    if len(files) > MAX_UPLOAD_FILES:
        raise InvalidInputError("Trop de fichiers (max 10)", code="TOO_MANY_FILES")
    result: list[tuple[str, bytes]] = []
    for upload in files:
        content = await upload.read(settings.upload_max_bytes + 1)
        if len(content) > settings.upload_max_bytes:
            raise InvalidInputError(
                f"Fichier trop volumineux (max {settings.upload_max_bytes // (1024 * 1024)} Mo)",
                code="FILE_TOO_LARGE",
            )
        result.append((upload.filename or "fichier.csv", content))
    return result


# --- Routes statiques AVANT /{dataset_id} ----------------------------------------------------


@router.get("", response_model=DatasetPage, operation_id="listDatasets")
def list_datasets(
    db: DbDep,
    _claims: CurrentClaims,
    query: Annotated[DatasetListQuery, Query()] = DatasetListQuery(),
) -> DatasetPage:
    page_size = query.page_size if query.page_size in (12, 24, 48, 96) else 24
    return service.list_datasets(
        db,
        query,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
        page=query.page,
        page_size=page_size,
    )


@router.get("/facets", response_model=DatasetFacets, operation_id="getDatasetFacets")
def get_facets(db: DbDep, _claims: CurrentClaims) -> DatasetFacets:
    return service.get_facets(db)


@router.get("/stats", response_model=CatalogStats, operation_id="getCatalogStats")
def get_stats(db: DbDep, _claims: CurrentClaims) -> CatalogStats:
    return service.get_stats(db)


@router.post(
    "/import/kaggle",
    response_model=KaggleImportResponse,
    status_code=202,
    operation_id="importKaggleDataset",
    dependencies=[ContributorDep],
)
def import_kaggle_dataset(
    payload: KaggleImportRequest, db: DbDep, claims: CurrentClaims
) -> KaggleImportResponse:
    """Import depuis un lien Kaggle collé — contributor+.

    Réponse immédiate : le lien est validé et dédupliqué ici (synchrone, donc l'utilisateur
    sait tout de suite si son lien est mauvais) ; le téléchargement part au worker.
    """
    ticket = kaggle_import.prepare(db, url=payload.url, user_id=claims.user_id)

    if ticket.existing_dataset_id is not None:
        return KaggleImportResponse(
            ref=ticket.ref.ref,
            existing_dataset_id=ticket.existing_dataset_id,
            duplicate_reason=ticket.duplicate_reason,
        )

    job = jobs_service.create_job(
        db, kind=JobKind.import_, queue="maintenance", user_id=claims.user_id
    )
    import_kaggle_task.delay(
        str(job.id),
        ticket.ref.owner,
        ticket.ref.slug,
        payload.access,
        str(claims.user_id) if claims.user_id else None,
    )
    return KaggleImportResponse(ref=ticket.ref.ref, job=JobRead.model_validate(job))


@router.post(
    "/preview",
    response_model=UploadAnalysis,
    operation_id="analyzeUpload",
    dependencies=[ContributorDep],
)
async def analyze_upload(files: Annotated[list[UploadFile], File()]) -> UploadAnalysis:
    """Analyse pré-upload SANS persistance (CDC §5.5.b) — contributor+."""
    return service.analyze_upload(await read_upload_files(files))


@router.post(
    "",
    response_model=DatasetDetail,
    status_code=201,
    operation_id="createDataset",
    dependencies=[ContributorDep],
)
async def create_dataset(
    db: DbDep,
    claims: CurrentClaims,
    files: Annotated[list[UploadFile], File()],
    metadata: Annotated[str, Form(description="JSON du schéma DatasetMetadataInput")] = "{}",
) -> DatasetDetail:
    """Création (multipart) : `metadata` = JSON du schéma DatasetMetadataInput + fichiers."""
    try:
        parsed = DatasetMetadataInput.model_validate(json.loads(metadata))
    except json.JSONDecodeError as exc:
        raise InvalidInputError(
            "Champ metadata illisible (JSON attendu)", code="BAD_METADATA"
        ) from exc
    except ValidationError as exc:
        raise InvalidInputError(
            f"Métadonnées invalides : {exc.errors()[0]['msg']}", code="BAD_METADATA"
        ) from exc
    dataset = service.create_dataset(
        db,
        metadata=parsed,
        files=await read_upload_files(files),
        owner_id=claims.user_id,
        apply_ethical_template=True,  # défauts M8 par domaine, sans écraser les valeurs saisies
    )
    return service.to_detail(dataset)


# --- Routes par dataset -----------------------------------------------------------------------


@router.get("/{dataset_id}", response_model=DatasetDetail, operation_id="getDataset")
def get_dataset(dataset_id: uuid.UUID, db: DbDep, _claims: CurrentClaims) -> DatasetDetail:
    return service.to_detail(service.get_dataset(db, dataset_id))


@router.put("/{dataset_id}", response_model=DatasetDetail, operation_id="updateDataset")
def update_dataset(
    dataset_id: uuid.UUID,
    payload: DatasetMetadataUpdate,
    db: DbDep,
    claims: CurrentClaims,
) -> DatasetDetail:
    dataset = service.get_dataset(db, dataset_id)
    require_owner_or_admin(claims, dataset.created_by)
    return service.to_detail(service.update_dataset(db, dataset, payload))


@router.post(
    "/{dataset_id}/ethics-review",
    response_model=DatasetDetail,
    operation_id="reviewDatasetEthics",
)
def review_dataset_ethics(
    dataset_id: uuid.UUID,
    payload: EthicsReviewInput,
    db: DbDep,
    claims: CurrentClaims,
) -> DatasetDetail:
    """Validation humaine des critères éthiques — propriétaire ou admin.

    C'est le SEUL chemin par lequel un critère peut devenir vrai et donc peser dans
    `ethical_score` : les suggestions de l'IA restent inertes tant que personne n'a tranché.
    """
    dataset = service.get_dataset(db, dataset_id)
    require_owner_or_admin(claims, dataset.created_by)
    reviewed = service.review_ethics(db, dataset, payload.values, reviewer_id=claims.user_id)
    return service.to_detail(reviewed)


@router.delete("/{dataset_id}", status_code=204, operation_id="deleteDataset")
def delete_dataset(dataset_id: uuid.UUID, db: DbDep, claims: CurrentClaims) -> None:
    dataset = service.get_dataset(db, dataset_id)
    require_owner_or_admin(claims, dataset.created_by)
    service.delete_dataset(db, dataset)


@router.get("/{dataset_id}/preview", response_model=DatasetPreview, operation_id="previewDataset")
def preview_dataset(
    dataset_id: uuid.UUID,
    db: DbDep,
    _claims: CurrentClaims,
    columns: Annotated[list[str] | None, Query()] = None,
) -> DatasetPreview:
    """Échantillon réel 50 lignes (random_state=42) — erreur explicite si indisponible (P1)."""
    return service.preview_dataset(db, dataset_id, columns=columns)


@router.get(
    "/{dataset_id}/similar", response_model=list[SimilarDataset], operation_id="getSimilarDatasets"
)
def get_similar(dataset_id: uuid.UUID, db: DbDep, _claims: CurrentClaims) -> list[SimilarDataset]:
    return service.similar_datasets(db, service.get_dataset(db, dataset_id))


@router.get("/{dataset_id}/files", response_model=list[FileRead], operation_id="listDatasetFiles")
def list_files(dataset_id: uuid.UUID, db: DbDep, _claims: CurrentClaims) -> list[FileRead]:
    dataset = service.get_dataset(db, dataset_id)
    return [FileRead.model_validate(f) for f in dataset.files]


@router.get(
    "/{dataset_id}/files/{file_id}/download",
    operation_id="downloadDatasetFile",
    response_class=StreamingResponse,
)
def download_file(
    dataset_id: uuid.UUID, file_id: uuid.UUID, db: DbDep, _claims: CurrentClaims
) -> StreamingResponse:
    """Streaming authentifié — les fichiers ne sont JAMAIS servis directement (ADR-005)."""
    from ibis.storage import get_storage

    dataset = service.get_dataset(db, dataset_id)
    file = next((f for f in dataset.files if f.id == file_id), None)
    if file is None or not get_storage().exists(file.storage_key):
        raise NotFoundError("Fichier introuvable", code="DATASET_FILE_UNAVAILABLE")
    stem = file.original_filename.rsplit(".", 1)[0]
    return StreamingResponse(
        get_storage().stream(file.storage_key),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{stem}.parquet"'},
    )


@router.get(
    "/{dataset_id}/completion", response_model=CompletionStatus, operation_id="getDatasetCompletion"
)
def get_completion(dataset_id: uuid.UUID, db: DbDep, _claims: CurrentClaims) -> CompletionStatus:
    return service.completion_status(service.get_dataset(db, dataset_id))


@router.post(
    "/{dataset_id}/ai-guide",
    response_model=AiGuideJob,
    status_code=202,
    operation_id="requestAiGuide",
)
def request_ai_guide(
    dataset_id: uuid.UUID,
    db: DbDep,
    claims: CurrentClaims,
    language: Annotated[str, Query(pattern="^(fr|en)$")] = "fr",
) -> AiGuideJob:
    """Analyse LLM asynchrone du dataset (job) — sortie balisée model_used / is_fallback (P2)."""
    dataset = service.get_dataset(db, dataset_id)
    job = jobs_service.create_job(
        db, kind=JobKind.guide, queue="llm", user_id=claims.user_id, ref_id=dataset.id
    )
    from ibis.workers.tasks.guide import generate_dataset_guide

    generate_dataset_guide.apply_async(args=[str(job.id), str(dataset.id), language], queue="llm")
    return AiGuideJob(job_id=job.id)


__all__ = ["JobRead", "router"]
