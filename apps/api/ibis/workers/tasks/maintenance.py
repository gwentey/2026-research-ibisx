"""Tâches périodiques de maintenance (ADR-004)."""

from ibis.core.logging import get_logger
from ibis.db.engine import open_session
from ibis.workers.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(name="ibis.workers.tasks.maintenance.purge_stale_running")
def purge_stale_running() -> int:
    """running sans battement > 10 min → failed WORKER_LOST (ARCH §5.4)."""
    from ibis.modules.experiments.service import purge_stale_running as purge

    db = open_session()
    try:
        count = purge(db)
        if count:
            logger.warning("maintenance.worker_lost_detected", count=count)
        return count
    finally:
        db.close()
