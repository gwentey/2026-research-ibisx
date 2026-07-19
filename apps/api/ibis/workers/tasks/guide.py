"""Tâche worker : génération du guide IA d'un dataset (file `llm`, ADR-004)."""

import uuid

from ibis.core.logging import get_logger
from ibis.db.engine import open_session
from ibis.modules.datasets import service as datasets_service
from ibis.modules.jobs import service as jobs_service
from ibis.modules.jobs.models import JobStatus
from ibis.modules.llm import client as llm_client
from ibis.modules.llm import guides
from ibis.modules.xai import blocks as rich
from ibis.workers.celery_app import celery_app

logger = get_logger(__name__)


def _generate_blocks(*, system: str, user: str, context: str, language: str) -> dict | None:
    """Guide v2 en blocs riches : jusqu'à 2 tentatives, sortie JSON validée (schéma ET
    anti-hallucination). None si aucune sortie exploitable → l'appelant bascule en repli.

    Même contrat que l'explication XAI (`workers/tasks/explain.py`) : c'est ce qui garantit
    un rendu visuel identique (tableaux, tuiles, callouts) entre le copilote et le guide.
    """
    for attempt in range(2):
        generated = llm_client.complete(system=system, user=user, max_tokens=1400, json_mode=True)
        try:
            doc = rich.parse_document(generated.text)
        except Exception as exc:  # JSON / schéma invalide → on retente
            logger.info("guide.invalid_blocks", attempt=attempt, reason=str(exc)[:200])
            continue
        if not guides.numbers_are_grounded(doc, context):
            logger.info("guide.hallucinated_number", attempt=attempt)
            continue
        return guides.guide_payload(
            text=rich.to_plain_text(doc),
            blocks=doc.model_dump(mode="json"),
            model_used=generated.model_used,
            is_fallback=False,
            language=language,
            tokens_used=generated.tokens_used,
        )
    logger.info("guide.fallback", reason="no_valid_answer")
    return None


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
        context = guides.dataset_context(dataset)
        payload: dict | None = None
        try:
            payload = _generate_blocks(system=system, user=user, context=context, language=language)
        except llm_client.LLMUnavailable as exc:
            logger.info("guide.unavailable", dataset_id=dataset_id, reason=str(exc)[:200])

        if payload is None:
            # Fallback déterministe HONNÊTE (P2) — jamais de texte inventé présenté comme IA.
            # Même document de blocs : le repli garde la richesse visuelle, badgé « sans IA ».
            doc = guides.fallback_document(dataset, language)
            payload = guides.guide_payload(
                text=rich.to_plain_text(doc),
                blocks=doc.model_dump(mode="json"),
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
