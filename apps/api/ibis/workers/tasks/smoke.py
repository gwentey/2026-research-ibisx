"""Tâche de démonstration du socle J0 : progression 0→100 visible en SSE."""

import time
import uuid

from ibis.core.logging import get_logger
from ibis.db.engine import open_session
from ibis.modules.jobs import service
from ibis.modules.jobs.models import JobStatus
from ibis.workers.celery_app import celery_app

logger = get_logger(__name__)

STEPS = [
    (10, "Initialisation du job de démonstration"),
    (30, "Vérification de la base de données"),
    (50, "Vérification du stockage partagé"),
    (70, "Vérification du pub/sub Redis"),
    (90, "Finalisation"),
    (100, "Terminé"),
]


@celery_app.task(name="ibis.workers.tasks.smoke.smoke_task", bind=True)
def smoke_task(self: object, job_id: str) -> str:
    jid = uuid.UUID(job_id)
    db = open_session()
    try:
        service.update_progress(db, jid, status=JobStatus.running, progress=0)
        for progress, log_line in STEPS:
            time.sleep(0.8)
            status = JobStatus.completed if progress == 100 else None
            service.update_progress(
                db, jid, progress=progress, status=status, log_line=log_line, message=log_line
            )
        logger.info("smoke_task.completed", job_id=job_id)
        return "ok"
    except Exception as exc:
        service.update_progress(
            db, jid, status=JobStatus.failed, error_code="SMOKE_FAILED", message=str(exc)
        )
        raise
    finally:
        db.close()
