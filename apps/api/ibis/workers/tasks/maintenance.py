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


@celery_app.task(name="ibis.workers.tasks.maintenance.purge_expired_chats")
def purge_expired_chats() -> int:
    """Sessions de chat inactives depuis 24 h → is_active=False (ADR-004)."""
    from ibis.modules.xai.service import purge_expired_chat_sessions

    db = open_session()
    try:
        count = purge_expired_chat_sessions(db)
        if count:
            logger.info("maintenance.chat_sessions_purged", count=count)
        return count
    finally:
        db.close()
