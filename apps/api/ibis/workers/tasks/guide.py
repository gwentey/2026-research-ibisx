"""Tâche worker : génération du guide IA d'un dataset (file `llm`, ADR-004)."""

import uuid

from ibis.core.logging import get_logger
from ibis.db.engine import open_session
from ibis.modules.datasets import service as datasets_service
from ibis.modules.jobs import service as jobs_service
from ibis.modules.jobs.models import JobStatus
from ibis.modules.llm import client as llm_client
from ibis.modules.llm import guides
from ibis.workers.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(name="ibis.workers.tasks.guide.generate_dataset_guide", bind=True)
def generate_dataset_guide(self: object, job_id: str, dataset_id: str, language: str) -> str:
    db = open_session()
    jid = uuid.UUID(job_id)
    try:
        jobs_service.update_progress(
            db, jid, status=JobStatus.running, progress=10, log_line="Chargement du dataset"
        )
        dataset = datasets_service.get_dataset(db, uuid.UUID(dataset_id))

        jobs_service.update_progress(db, jid, progress=40, log_line="Génération du guide")
        system, user = guides.build_prompt(dataset, language)
        try:
            result = llm_client.complete(system=system, user=user)
            payload = guides.guide_payload(
                text=result.text,
                model_used=result.model_used,
                is_fallback=False,
                language=language,
                tokens_used=result.tokens_used,
            )
        except llm_client.LLMUnavailable as exc:
            # Fallback déterministe HONNÊTE (P2) — jamais de texte inventé présenté comme IA
            logger.info("guide.fallback", dataset_id=dataset_id, reason=str(exc))
            payload = guides.guide_payload(
                text=guides.fallback_guide(dataset, language),
                model_used="fallback",
                is_fallback=True,
                language=language,
                tokens_used=0,
            )

        dataset.ai_guide = payload
        db.commit()
        jobs_service.update_progress(
            db, jid, status=JobStatus.completed, progress=100, log_line="Guide prêt"
        )
        return "ok"
    except Exception as exc:
        jobs_service.update_progress(
            db, jid, status=JobStatus.failed, error_code="GUIDE_FAILED", message=str(exc)
        )
        raise
    finally:
        db.close()
