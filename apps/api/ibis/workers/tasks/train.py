"""Tâche d'entraînement (CDC §8.3) — séquence exacte, honnête, reproductible.

Jalons de progression : 10 chargement → 30 données prêtes → 50 preprocessing
appliqué → 70 modèle entraîné → 90 évaluation & artefacts → 100 terminé.
JAMAIS d'entraînement de secours sur données synthétiques ([NE PAS REPRODUIRE] T6).
"""

import contextlib
import io
import time
import uuid
from datetime import UTC, datetime

import joblib
from celery.exceptions import SoftTimeLimitExceeded

from ibis.core.config import get_settings
from ibis.core.errors import AppError, NotFoundError
from ibis.core.logging import get_logger
from ibis.db.engine import open_session
from ibis.modules.datasets.service import get_dataset, load_file_dataframe
from ibis.modules.experiments import service as experiments_service
from ibis.modules.experiments.models import Experiment, ExperimentStatus
from ibis.modules.jobs import service as jobs_service
from ibis.modules.jobs.models import JobStatus
from ibis.modules.ml import algorithms as algo_registry
from ibis.modules.ml import evaluation
from ibis.modules.ml.preprocessing import PreprocessingConfig, preprocess
from ibis.storage import get_storage
from ibis.workers.celery_app import celery_app

logger = get_logger(__name__)


def _progress(db, experiment: Experiment, value: int, message: str) -> None:  # type: ignore[no-untyped-def]
    experiment.progress = value
    db.commit()
    experiments_service.add_log(db, experiment.id, message)
    if experiment.job_id:
        jobs_service.update_progress(db, experiment.job_id, progress=value, log_line=message)


@celery_app.task(
    name="ibis.workers.tasks.train.train_experiment",
    bind=True,
    acks_late=True,
    soft_time_limit=get_settings().training_timeout_seconds,
    time_limit=get_settings().training_timeout_seconds + 300,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_kwargs={"max_retries": 3, "countdown": 60},
)
def train_experiment(self: object, experiment_id: str, job_id: str) -> str:
    db = open_session()
    experiment: Experiment | None = None
    artifact_key: str | None = None
    started = time.perf_counter()
    try:
        experiment = db.get(Experiment, uuid.UUID(experiment_id))
        if experiment is None or experiment.status == ExperimentStatus.cancelled:
            return "skipped"
        experiment.status = ExperimentStatus.running
        experiment.started_at = datetime.now(UTC).replace(tzinfo=None)
        db.commit()
        jobs_service.update_progress(db, uuid.UUID(job_id), status=JobStatus.running, progress=5)

        # 1 — chargement du Parquet (échec explicite si indisponible)
        _progress(db, experiment, 10, "Chargement du dataset…")
        dataset = get_dataset(db, experiment.dataset_id)
        if not dataset.files:
            raise NotFoundError("Dataset sans fichier", code="DATASET_UNAVAILABLE")
        df = load_file_dataframe(dataset.files[0])
        _progress(db, experiment, 30, f"Données chargées ({len(df)} lignes)")

        # 2–5 — nettoyage + préparation RÉELLEMENT appliqués (contrat d'honnêteté)
        config = PreprocessingConfig.model_validate(experiment.preprocessing_config)
        prepared = preprocess(df, config)
        strategies = prepared.applied.get("column_strategies", {})
        imputed = [f"{c} ({s})" for c, s in strategies.items() if s not in ("drop_column",)]
        _progress(
            db,
            experiment,
            50,
            f"Préprocessing appliqué — {len(imputed)} colonnes traitées, "
            f"{len(prepared.feature_names)} features",
        )

        # 6 — entraînement (wrapper du registre, random_state=42)
        estimator = algo_registry.build_estimator(
            experiment.algorithm or "", config.task_type, experiment.hyperparameters
        )
        estimator.fit(prepared.X_train, prepared.y_train)
        _progress(db, experiment, 70, f"Modèle {experiment.algorithm} entraîné")

        # 7 — évaluation + importance + structure d'arbre
        if config.task_type == "classification":
            metrics, viz = evaluation.evaluate_classification(
                estimator, prepared.X_test, prepared.y_test, prepared.class_names or []
            )
        else:
            metrics, viz = evaluation.evaluate_regression(
                estimator, prepared.X_test, prepared.y_test
            )
        importance = evaluation.feature_importances(estimator, prepared.feature_names)
        if importance:
            viz["feature_importance"] = importance
        tree = algo_registry.extract_tree_structure(
            estimator, prepared.feature_names, prepared.class_names
        )
        if tree:
            viz["tree_structure"] = tree

        # 8 — artefact joblib {model, preprocessing_pipeline, feature_names, training_config}
        _progress(db, experiment, 90, "Évaluation terminée — sérialisation de l'artefact")
        buffer = io.BytesIO()
        joblib.dump(
            {
                "model": estimator,
                "preprocessing_pipeline": prepared.pipeline,
                "label_encoder": prepared.label_encoder,
                "feature_names": prepared.feature_names,
                "class_names": prepared.class_names,
                "training_config": {
                    "algorithm": experiment.algorithm,
                    "hyperparameters": experiment.hyperparameters,
                    "preprocessing": experiment.preprocessing_config,
                    "random_state": 42,
                },
            },
            buffer,
        )
        buffer.seek(0)
        artifact_key = f"models/{experiment.id}/model.joblib"
        get_storage().save(artifact_key, buffer)

        # 9 — écriture des résultats
        experiment.metrics = metrics
        experiment.viz_data = viz
        experiment.feature_importance = importance
        experiment.applied_preprocessing = prepared.applied
        experiment.artifact_key = artifact_key
        experiment.status = ExperimentStatus.completed
        experiment.finished_at = datetime.now(UTC).replace(tzinfo=None)
        experiment.duration_seconds = round(time.perf_counter() - started, 2)
        db.commit()
        _progress(db, experiment, 100, "Entraînement terminé")
        jobs_service.update_progress(
            db, uuid.UUID(job_id), status=JobStatus.completed, progress=100
        )
        return "completed"

    except SoftTimeLimitExceeded:
        _fail(
            db,
            experiment,
            job_id,
            "TIMEOUT",
            "Durée maximale d'entraînement dépassée (2 h)",
            artifact_key,
        )
        raise
    except AppError as exc:
        _fail(db, experiment, job_id, exc.code, exc.message, artifact_key)
        return "failed"
    except Exception as exc:  # échec inattendu : visible, jamais de repli synthétique
        logger.exception("train.failed", experiment_id=experiment_id)
        _fail(db, experiment, job_id, "INTERNAL_ERROR", str(exc)[:300], artifact_key)
        return "failed"
    finally:
        db.close()


def _fail(db, experiment, job_id: str, code: str, message: str, artifact_key: str | None) -> None:  # type: ignore[no-untyped-def]
    if artifact_key:
        with contextlib.suppress(Exception):
            get_storage().delete(artifact_key)  # nettoyage des artefacts partiels
    if experiment is not None:
        experiment.status = ExperimentStatus.failed
        experiment.error_code = code
        experiment.error_message = message
        experiment.finished_at = datetime.now(UTC).replace(tzinfo=None)
        db.commit()
        experiments_service.add_log(db, experiment.id, f"Échec : {message}", level="error")
    with contextlib.suppress(Exception):
        jobs_service.update_progress(
            db, uuid.UUID(job_id), status=JobStatus.failed, error_code=code, message=message
        )
