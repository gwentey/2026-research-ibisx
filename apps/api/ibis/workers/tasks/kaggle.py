"""Tâche worker : import d'un dataset Kaggle (file `maintenance`, ADR-004).

Le téléchargement peut durer (plusieurs dizaines de Mo) : la route rend la main
immédiatement, le suivi passe par le job.
"""

import uuid

from ibis.core.errors import AppError
from ibis.core.logging import get_logger
from ibis.db.engine import open_session
from ibis.modules.datasets import kaggle_import
from ibis.modules.datasets.kaggle_client import KaggleRef
from ibis.modules.jobs import service as jobs_service
from ibis.modules.jobs.models import JobStatus
from ibis.workers.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(name="ibis.workers.tasks.kaggle.import_kaggle_dataset", bind=True)
def import_kaggle_dataset(
    self: object,
    job_id: str,
    owner: str,
    slug: str,
    access_requested: str,
    user_id: str | None,
) -> str:
    db = open_session()
    jid = uuid.UUID(job_id)
    ref = KaggleRef(owner=owner, slug=slug)
    try:
        jobs_service.update_progress(
            db,
            jid,
            status=JobStatus.running,
            progress=10,
            log_line=f"Téléchargement de {ref.ref} depuis Kaggle",
        )

        dataset = kaggle_import.run_import(
            db,
            ref=ref,
            access_requested=access_requested,
            user_id=uuid.UUID(user_id) if user_id else None,
        )

        jobs_service.update_progress(
            db,
            jid,
            status=JobStatus.completed,
            progress=100,
            log_line=f"« {dataset.display_name} » importé",
        )
        # `ref_id` pointe le dataset créé : le front sait où rediriger à la fin.
        job = jobs_service.get_job(db, jid)
        job.ref_id = dataset.id
        db.commit()
        return str(dataset.id)

    except AppError as exc:
        # Erreur métier attendue (lien mort, licence, taille, pas de CSV) : message LISIBLE,
        # pas une trace Python. C'est ce que l'utilisateur verra dans l'interface.
        db.rollback()
        logger.info("kaggle.import_rejected", ref=ref.ref, code=exc.code, reason=str(exc))
        jobs_service.update_progress(
            db,
            jid,
            status=JobStatus.failed,
            error_code=exc.code or "KAGGLE_IMPORT_FAILED",
            message=str(exc)[:512],
        )
        return "failed"

    except Exception as exc:
        db.rollback()
        logger.exception("kaggle.import_crashed", ref=ref.ref)
        jobs_service.update_progress(
            db,
            jid,
            status=JobStatus.failed,
            error_code="KAGGLE_IMPORT_FAILED",
            message=str(exc)[:512],
        )
        raise
    finally:
        db.close()
