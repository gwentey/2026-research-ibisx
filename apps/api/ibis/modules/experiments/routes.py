"""Routes expériences (CDC §8, §7.3) + analyse qualité (étape 3) + algorithmes."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ibis.core.errors import NotFoundError
from ibis.db.engine import get_db
from ibis.modules.auth.deps import CurrentClaims, CurrentUser
from ibis.modules.experiments import service
from ibis.modules.experiments.schemas import (
    CompareRequest,
    CompareResponse,
    DraftUpsert,
    ExperimentCreate,
    ExperimentRead,
    ExperimentResults,
    ExperimentSummary,
    ExperimentWithQueue,
    LogLine,
)
from ibis.modules.ml import algorithms as algo_registry
from ibis.modules.ml import quality as quality_service

router = APIRouter(tags=["experiments"])

DbDep = Annotated[Session, Depends(get_db)]


@router.get("/algorithms", operation_id="listAlgorithms")
def list_algorithms(_claims: CurrentClaims) -> list[dict[str, Any]]:
    """Cartes d'algorithmes + schémas d'hyperparamètres (source du formulaire, CDC §8.2 É6-7)."""
    return algo_registry.hyperparameter_schemas()


@router.get("/datasets/{dataset_id}/quality-analysis", operation_id="getQualityAnalysis")
def get_quality_analysis(
    dataset_id: uuid.UUID,
    db: DbDep,
    _claims: CurrentClaims,
    force: bool = False,
) -> dict[str, Any]:
    """Analyse de qualité serveur, cache 7 j invalidable (CDC §8.2 É3)."""
    analysis = quality_service.get_or_compute_quality(db, dataset_id, force=force)
    return {
        "dataset_id": str(analysis.dataset_id),
        "quality_score": analysis.quality_score,
        "analysis": analysis.analysis,
        "column_recommendations": analysis.column_recommendations,
        "computed_at": analysis.computed_at.isoformat() if analysis.computed_at else None,
    }


@router.put("/experiments/draft", response_model=ExperimentRead, operation_id="upsertDraft")
def upsert_draft(payload: DraftUpsert, db: DbDep, claims: CurrentClaims) -> ExperimentRead:
    """Brouillon persisté à chaque étape validée → reprise du wizard (P5)."""
    return ExperimentRead.model_validate(service.upsert_draft(db, claims.user_id, payload))


@router.get("/experiments/draft", response_model=ExperimentRead | None, operation_id="getDraft")
def get_draft(
    db: DbDep,
    claims: CurrentClaims,
    project_id: Annotated[uuid.UUID, Query()],
    dataset_id: Annotated[uuid.UUID, Query()],
) -> ExperimentRead | None:
    draft = service.get_draft(db, claims.user_id, project_id, dataset_id)
    return ExperimentRead.model_validate(draft) if draft else None


@router.post(
    "/experiments", response_model=ExperimentRead, status_code=201, operation_id="startExperiment"
)
def start_experiment(payload: ExperimentCreate, db: DbDep, user: CurrentUser) -> ExperimentRead:
    """Lancement : validation registre + quotas + débit 1 crédit → file `training`."""
    return ExperimentRead.model_validate(service.start_experiment(db, user, payload))


@router.get(
    "/experiments/{experiment_id}", response_model=ExperimentWithQueue, operation_id="getExperiment"
)
def get_experiment(
    experiment_id: uuid.UUID, db: DbDep, claims: CurrentClaims
) -> ExperimentWithQueue:
    experiment = service.get_experiment(db, claims.user_id, experiment_id)
    read = ExperimentWithQueue.model_validate(experiment)
    read.queue_position = service.queue_position(db, experiment)
    return read


@router.get(
    "/experiments/{experiment_id}/results",
    response_model=ExperimentResults,
    operation_id="getExperimentResults",
)
def get_results(experiment_id: uuid.UUID, db: DbDep, claims: CurrentClaims) -> ExperimentResults:
    return service.results(db, service.get_experiment(db, claims.user_id, experiment_id))


@router.get(
    "/experiments/{experiment_id}/logs",
    response_model=list[LogLine],
    operation_id="getExperimentLogs",
)
def get_logs(experiment_id: uuid.UUID, db: DbDep, claims: CurrentClaims) -> list[LogLine]:
    experiment = service.get_experiment(db, claims.user_id, experiment_id)
    return [LogLine.model_validate(line) for line in service.logs(db, experiment)]


@router.post(
    "/experiments/{experiment_id}/cancel",
    response_model=ExperimentRead,
    operation_id="cancelExperiment",
)
def cancel_experiment(experiment_id: uuid.UUID, db: DbDep, user: CurrentUser) -> ExperimentRead:
    experiment = service.get_experiment(db, user.id, experiment_id)
    return ExperimentRead.model_validate(service.cancel_experiment(db, user, experiment))


@router.delete("/experiments/{experiment_id}", status_code=204, operation_id="deleteExperiment")
def delete_experiment(experiment_id: uuid.UUID, db: DbDep, claims: CurrentClaims) -> None:
    service.delete_experiment(db, service.get_experiment(db, claims.user_id, experiment_id))


@router.get(
    "/experiments/{experiment_id}/download-model",
    operation_id="downloadModel",
    response_class=StreamingResponse,
)
def download_model(experiment_id: uuid.UUID, db: DbDep, claims: CurrentClaims) -> StreamingResponse:
    """Artefact .joblib {model, preprocessing_pipeline, feature_names, training_config}."""
    from ibis.storage import get_storage

    experiment = service.get_experiment(db, claims.user_id, experiment_id)
    if not experiment.artifact_key or not get_storage().exists(experiment.artifact_key):
        raise NotFoundError("Modèle indisponible", code="MODEL_UNAVAILABLE")
    return StreamingResponse(
        get_storage().stream(experiment.artifact_key),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="ibisx-model-{experiment_id}.joblib"'
        },
    )


@router.post(
    "/experiments/compare", response_model=CompareResponse, operation_id="compareExperiments"
)
def compare_experiments(
    payload: CompareRequest, db: DbDep, claims: CurrentClaims
) -> CompareResponse:
    """Benchmarking (CDC §7.2) : métriques alignées côte à côte."""
    return service.compare(db, claims.user_id, payload.experiment_ids)


@router.get("/experiments", response_model=list[ExperimentSummary], operation_id="listExperiments")
def list_experiments(
    db: DbDep,
    claims: CurrentClaims,
    status: Annotated[str | None, Query(max_length=20)] = None,
    project_id: Annotated[uuid.UUID | None, Query()] = None,
    algorithm: Annotated[str | None, Query(max_length=50)] = None,
) -> list[ExperimentSummary]:
    """Liste globale des expériences de l'utilisateur (CDC §10) — filtres simples."""
    return service.list_all(
        db, claims.user_id, status=status, project_id=project_id, algorithm=algorithm
    )


@router.get(
    "/projects/{project_id}/experiments",
    response_model=list[ExperimentSummary],
    operation_id="listProjectExperiments",
)
def list_project_experiments(
    project_id: uuid.UUID, db: DbDep, claims: CurrentClaims
) -> list[ExperimentSummary]:
    return service.project_experiments(db, claims.user_id, project_id)
