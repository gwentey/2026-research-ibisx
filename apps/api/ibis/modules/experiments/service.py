"""Service expériences : quotas, crédits, brouillon, cycle de vie, comparaison."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ibis.core.config import get_settings
from ibis.core.errors import AppError, ConflictError, NotFoundError, QuotaExceededError
from ibis.core.logging import get_logger
from ibis.modules.auth.models import User
from ibis.modules.datasets.models import Dataset
from ibis.modules.datasets.service import get_dataset
from ibis.modules.experiments.models import Experiment, ExperimentLog, ExperimentStatus
from ibis.modules.experiments.schemas import (
    CompareResponse,
    CompareRow,
    DraftUpsert,
    ExperimentCreate,
    ExperimentResults,
    ExperimentSummary,
)
from ibis.modules.jobs import service as jobs_service
from ibis.modules.jobs.models import JobKind, JobStatus
from ibis.modules.ml import algorithms as algo_registry
from ibis.modules.ml.evaluation import composite_score
from ibis.modules.projects.service import get_project

logger = get_logger(__name__)

ACTIVE_STATUSES = (ExperimentStatus.pending, ExperimentStatus.running)


def get_experiment(db: Session, user_id: uuid.UUID, experiment_id: uuid.UUID) -> Experiment:
    experiment = db.scalar(
        select(Experiment).where(Experiment.id == experiment_id, Experiment.user_id == user_id)
    )
    if experiment is None:
        raise NotFoundError("Expérience introuvable", code="EXPERIMENT_NOT_FOUND")
    return experiment


# ------------------------------- Brouillon (reprise wizard) ---------------------------------


def upsert_draft(db: Session, user_id: uuid.UUID, payload: DraftUpsert) -> Experiment:
    get_project(db, user_id, payload.project_id)  # isolation projet
    get_dataset(db, payload.dataset_id)  # existence dataset
    draft = db.scalar(
        select(Experiment).where(
            Experiment.user_id == user_id,
            Experiment.project_id == payload.project_id,
            Experiment.dataset_id == payload.dataset_id,
            Experiment.status == ExperimentStatus.draft,
        )
    )
    if draft is None:
        draft = Experiment(
            user_id=user_id,
            project_id=payload.project_id,
            dataset_id=payload.dataset_id,
            status=ExperimentStatus.draft,
        )
        db.add(draft)
    draft.draft_state = payload.state
    db.commit()
    db.refresh(draft)
    return draft


def get_draft(
    db: Session, user_id: uuid.UUID, project_id: uuid.UUID, dataset_id: uuid.UUID
) -> Experiment | None:
    return db.scalar(
        select(Experiment).where(
            Experiment.user_id == user_id,
            Experiment.project_id == project_id,
            Experiment.dataset_id == dataset_id,
            Experiment.status == ExperimentStatus.draft,
        )
    )


# ------------------------------- Lancement (quotas + crédits) --------------------------------


def enforce_quotas_and_debit(db: Session, user: User) -> None:
    """CDC §3.3 : 3 simultanés, 20/jour, 1 crédit — tout configurable par env."""
    settings = get_settings()
    active = (
        db.scalar(
            select(func.count(Experiment.id)).where(
                Experiment.user_id == user.id, Experiment.status.in_(ACTIVE_STATUSES)
            )
        )
        or 0
    )
    if active >= settings.max_concurrent_trainings:
        raise QuotaExceededError(
            f"Maximum {settings.max_concurrent_trainings} entraînements simultanés — "
            "attendez la fin d'un entraînement en cours",
            code="MAX_CONCURRENT_TRAININGS",
        )
    day_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    today = (
        db.scalar(
            select(func.count(Experiment.id)).where(
                Experiment.user_id == user.id,
                Experiment.status != ExperimentStatus.draft,
                Experiment.created_at >= day_start,
            )
        )
        or 0
    )
    if today >= settings.max_daily_trainings:
        raise QuotaExceededError(
            f"Maximum {settings.max_daily_trainings} entraînements par jour atteint",
            code="MAX_DAILY_TRAININGS",
        )
    if user.credits < 1:
        raise AppError(
            "Crédits insuffisants — demandez une recharge à un administrateur",
            code="INSUFFICIENT_CREDITS",
            status_code=402,
        )
    user.credits -= 1  # débit : 1 entraînement = 1 crédit


def start_experiment(db: Session, user: User, payload: ExperimentCreate) -> Experiment:
    get_project(db, user.id, payload.project_id)
    dataset = get_dataset(db, payload.dataset_id)
    if not dataset.files:
        raise NotFoundError("Ce dataset n'a aucun fichier de données", code="DATASET_NO_FILE")

    hyperparameters = algo_registry.validate_hyperparameters(
        payload.algorithm, payload.hyperparameters
    )
    enforce_quotas_and_debit(db, user)

    # Le brouillon (s'il existe) devient l'expérience lancée
    experiment = get_draft(db, user.id, payload.project_id, payload.dataset_id)
    if experiment is None:
        experiment = Experiment(
            user_id=user.id, project_id=payload.project_id, dataset_id=payload.dataset_id
        )
        db.add(experiment)
    experiment.algorithm = payload.algorithm
    experiment.hyperparameters = hyperparameters
    experiment.preprocessing_config = payload.preprocessing.model_dump()
    experiment.status = ExperimentStatus.pending
    experiment.progress = 0
    experiment.draft_state = None
    experiment.error_code = None
    experiment.error_message = None

    job = jobs_service.create_job(
        db, kind=JobKind.training, queue="training", user_id=user.id, ref_id=experiment.id
    )
    experiment.job_id = job.id
    db.commit()
    db.refresh(experiment)

    from ibis.workers.tasks.train import train_experiment

    async_result = train_experiment.apply_async(
        args=[str(experiment.id), str(job.id)], queue="training"
    )
    experiment.task_id = async_result.id
    db.commit()
    logger.info("experiment.enqueued", experiment_id=str(experiment.id))
    return experiment


def queue_position(db: Session, experiment: Experiment) -> int | None:
    if experiment.status != ExperimentStatus.pending:
        return None
    ahead = db.scalar(
        select(func.count(Experiment.id)).where(
            Experiment.status == ExperimentStatus.pending,
            Experiment.created_at < experiment.created_at,
        )
    )
    return int(ahead or 0)


def cancel_experiment(db: Session, user: User, experiment: Experiment) -> Experiment:
    if experiment.status not in ACTIVE_STATUSES:
        raise ConflictError("Cette expérience n'est plus annulable", code="NOT_CANCELLABLE")
    was_pending = experiment.status == ExperimentStatus.pending
    if experiment.task_id:
        from ibis.workers.celery_app import celery_app

        celery_app.control.revoke(experiment.task_id, terminate=True)
    experiment.status = ExperimentStatus.cancelled
    experiment.finished_at = datetime.now(UTC).replace(tzinfo=None)
    if experiment.job_id:
        jobs_service.update_progress(db, experiment.job_id, status=JobStatus.cancelled)
    if was_pending:
        user.credits += 1  # remboursement : le calcul n'a jamais commencé
    # Nettoyage d'artefacts partiels
    if experiment.artifact_key:
        from ibis.storage import get_storage

        get_storage().delete(experiment.artifact_key)
        experiment.artifact_key = None
    db.commit()
    db.refresh(experiment)
    return experiment


def delete_experiment(db: Session, experiment: Experiment) -> None:
    if experiment.status in ACTIVE_STATUSES:
        raise ConflictError("Annulez l'expérience avant de la supprimer", code="STILL_RUNNING")
    if experiment.artifact_key:
        from ibis.storage import get_storage

        get_storage().delete(experiment.artifact_key)
    db.delete(experiment)
    db.commit()


# ------------------------------- Lectures ----------------------------------------------------


def results(db: Session, experiment: Experiment) -> ExperimentResults:
    if experiment.status != ExperimentStatus.completed:
        raise ConflictError(
            f"Résultats indisponibles (statut : {experiment.status})", code="NOT_COMPLETED"
        )
    task_type = str(experiment.preprocessing_config.get("task_type", "classification"))
    metrics = experiment.metrics or {}
    return ExperimentResults(
        id=experiment.id,
        status=experiment.status.value,
        task_type=task_type,
        algorithm=experiment.algorithm or "",
        metrics=metrics,
        viz_data=experiment.viz_data or {},
        feature_importance=experiment.feature_importance or [],
        applied_preprocessing=experiment.applied_preprocessing or {},
        composite=composite_score(metrics, task_type),
        class_names=(experiment.viz_data or {}).get("confusion_matrix", {}).get("classes"),
    )


def primary_metric(experiment: Experiment) -> tuple[str | None, float | None]:
    metrics = experiment.metrics or {}
    name = metrics.get("primary_metric")
    if name and name in metrics:
        return str(name), float(metrics[name])
    return None, None


def project_experiments(
    db: Session, user_id: uuid.UUID, project_id: uuid.UUID
) -> list[ExperimentSummary]:
    get_project(db, user_id, project_id)
    rows = db.execute(
        select(Experiment, Dataset.display_name)
        .join(Dataset, Dataset.id == Experiment.dataset_id)
        .where(
            Experiment.project_id == project_id,
            Experiment.user_id == user_id,
            Experiment.status != ExperimentStatus.draft,
        )
        .order_by(Experiment.created_at.desc())
    ).all()
    summaries = []
    for experiment, dataset_name in rows:
        name, value = primary_metric(experiment)
        summaries.append(
            ExperimentSummary(
                id=experiment.id,
                dataset_id=experiment.dataset_id,
                dataset_name=dataset_name,
                algorithm=experiment.algorithm,
                status=experiment.status.value,
                progress=experiment.progress,
                primary_metric_name=name,
                primary_metric_value=value,
                duration_seconds=experiment.duration_seconds,
                created_at=experiment.created_at,
            )
        )
    return summaries


def list_all(
    db: Session,
    user_id: uuid.UUID,
    *,
    status: str | None = None,
    project_id: uuid.UUID | None = None,
    algorithm: str | None = None,
) -> list[ExperimentSummary]:
    """Liste globale (CDC §10) — brouillons exclus, filtres statut/projet/algo."""
    query = (
        select(Experiment, Dataset.display_name)
        .join(Dataset, Dataset.id == Experiment.dataset_id)
        .where(Experiment.user_id == user_id, Experiment.status != ExperimentStatus.draft)
    )
    if status:
        query = query.where(Experiment.status == status)
    if project_id:
        query = query.where(Experiment.project_id == project_id)
    if algorithm:
        query = query.where(Experiment.algorithm == algorithm)
    rows = db.execute(query.order_by(Experiment.created_at.desc()).limit(200)).all()
    summaries = []
    for experiment, dataset_name in rows:
        name, value = primary_metric(experiment)
        summaries.append(
            ExperimentSummary(
                id=experiment.id,
                dataset_id=experiment.dataset_id,
                dataset_name=dataset_name,
                algorithm=experiment.algorithm,
                status=experiment.status.value,
                progress=experiment.progress,
                primary_metric_name=name,
                primary_metric_value=value,
                duration_seconds=experiment.duration_seconds,
                created_at=experiment.created_at,
            )
        )
    return summaries


def compare(db: Session, user_id: uuid.UUID, experiment_ids: list[uuid.UUID]) -> CompareResponse:
    """Benchmarking (CDC §7.2) : métriques alignées de N expériences terminées."""
    rows: list[CompareRow] = []
    for experiment_id in experiment_ids:
        experiment = get_experiment(db, user_id, experiment_id)
        if experiment.status != ExperimentStatus.completed:
            raise ConflictError(
                f"L'expérience {experiment_id} n'est pas terminée", code="NOT_COMPLETED"
            )
        dataset = db.get(Dataset, experiment.dataset_id)
        rows.append(
            CompareRow(
                experiment_id=experiment.id,
                dataset_name=dataset.display_name if dataset else "?",
                algorithm=experiment.algorithm or "",
                task_type=str(experiment.preprocessing_config.get("task_type", "")),
                metrics={
                    k: v
                    for k, v in (experiment.metrics or {}).items()
                    if isinstance(v, (int, float))
                },
            )
        )
    common: set[str] = set.intersection(*(set(r.metrics) for r in rows)) if rows else set()
    ordered = [
        k
        for k in (
            "f1_macro",
            "accuracy",
            "precision_macro",
            "recall_macro",
            "f1_score",
            "roc_auc",
            "oob_score",
            "mae",
            "rmse",
            "mse",
            "r2",
        )
        if k in common
    ]
    return CompareResponse(rows=rows, metric_keys=ordered)


def add_log(db: Session, experiment_id: uuid.UUID, message: str, level: str = "info") -> None:
    db.add(ExperimentLog(experiment_id=experiment_id, message=message[:512], level=level))
    db.commit()


def logs(db: Session, experiment: Experiment) -> list[ExperimentLog]:
    return list(
        db.scalars(
            select(ExperimentLog)
            .where(ExperimentLog.experiment_id == experiment.id)
            .order_by(ExperimentLog.ts.asc())
        )
    )


def purge_stale_running(db: Session, *, max_minutes: int = 10) -> int:
    """Worker perdu : running sans battement > 10 min → failed WORKER_LOST (ARCH §5.4)."""
    threshold = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=max_minutes)
    stale = db.scalars(
        select(Experiment).where(
            Experiment.status == ExperimentStatus.running, Experiment.updated_at < threshold
        )
    ).all()
    for experiment in stale:
        experiment.status = ExperimentStatus.failed
        experiment.error_code = "WORKER_LOST"
        experiment.error_message = "Le worker n'a plus donné signe de vie pendant l'entraînement"
        if experiment.job_id:
            jobs_service.update_progress(
                db, experiment.job_id, status=JobStatus.failed, error_code="WORKER_LOST"
            )
    db.commit()
    return len(stale)
