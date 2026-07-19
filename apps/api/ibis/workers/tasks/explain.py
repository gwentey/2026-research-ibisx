"""Tâches worker XAI : génération d'explication (file xai) + réponse chat (file llm).

Tout est asynchrone ([NE PAS REPRODUIRE] X9 : chat bloquant 60 s en HTTP).
"""

import contextlib
import time
import uuid
from datetime import UTC, datetime

from ibis.core.errors import AppError
from ibis.core.logging import get_logger
from ibis.db.engine import open_session
from ibis.modules.experiments.models import Experiment
from ibis.modules.jobs import service as jobs_service
from ibis.modules.jobs.models import JobStatus
from ibis.modules.llm import client as llm_client
from ibis.modules.llm import xai_text
from ibis.modules.xai import blocks as xai_blocks
from ibis.modules.xai import engine
from ibis.modules.xai import quality as xai_quality
from ibis.modules.xai.models import ChatMessage, ChatSession, Explanation, ExplanationStatus
from ibis.workers.celery_app import celery_app

logger = get_logger(__name__)


def _generate_text(explanation: Explanation, experiment: Experiment, result: dict) -> dict:
    """Texte adaptatif LLM avec anti-hallucination, sinon fallback déterministe (P2)."""
    importance = result["values"].get("importance") or result["values"].get("contributions") or []
    context = xai_text.build_context(
        metrics=experiment.metrics or {},
        importance=importance,
        task_type=str(experiment.preprocessing_config.get("task_type", "")),
        algorithm=experiment.algorithm or "",
        explanation_type=explanation.type.value,
        local_values=result["values"] if explanation.type.value == "local" else None,
    )
    system, user = xai_text.build_prompt(
        audience=explanation.audience_level, language=explanation.language, context=context
    )
    try:
        for _attempt in range(2):  # régénération unique si nombre inventé
            generated = llm_client.complete(system=system, user=user)
            if xai_text.numbers_exist_in_context(generated.text, context):
                return {
                    "text": generated.text,
                    "model_used": generated.model_used,
                    "is_fallback": False,
                    "tokens_used": generated.tokens_used,
                }
            logger.warning("xai_text.hallucination_detected", explanation_id=str(explanation.id))
    except llm_client.LLMUnavailable as exc:
        logger.info("xai_text.fallback", reason=str(exc))
    return {
        "text": xai_text.fallback_text(
            audience=explanation.audience_level,
            language=explanation.language,
            metrics=experiment.metrics or {},
            importance=importance,
            task_type=str(experiment.preprocessing_config.get("task_type", "")),
            algorithm=experiment.algorithm or "",
        ),
        "model_used": "fallback",
        "is_fallback": True,
        "tokens_used": 0,
    }


@celery_app.task(
    name="ibis.workers.tasks.explain.generate_explanation",
    bind=True,
    soft_time_limit=1800,
    time_limit=1900,
)
def generate_explanation(self: object, explanation_id: str, job_id: str) -> str:
    db = open_session()
    started = time.perf_counter()
    explanation: Explanation | None = None
    try:
        explanation = db.get(Explanation, uuid.UUID(explanation_id))
        if explanation is None:
            return "skipped"
        experiment = db.get(Experiment, explanation.experiment_id)
        if experiment is None:
            raise AppError("Expérience disparue", code="EXPERIMENT_NOT_FOUND")

        explanation.status = ExplanationStatus.running
        db.commit()
        jobs_service.update_progress(
            db,
            uuid.UUID(job_id),
            status=JobStatus.running,
            progress=10,
            log_line="Chargement du modèle et des données",
        )

        loaded = engine.load_experiment_context(db, experiment)
        method, justification = engine.choose_method(loaded.model, explanation.method_requested)
        explanation.method_used = method
        explanation.method_justification = justification
        db.commit()
        jobs_service.update_progress(
            db,
            uuid.UUID(job_id),
            progress=35,
            log_line=f"Calcul {method} en cours",
        )

        instance_index = (explanation.instance_ref or {}).get("index")
        if explanation.type.value == "local":
            if instance_index is None:
                raise AppError("Instance de test manquante", code="INSTANCE_REQUIRED")
            result = (
                engine.run_shap_local(loaded, int(instance_index))
                if method == "shap_tree"
                else engine.run_lime_local(loaded, int(instance_index))
            )
        else:
            result = (
                engine.run_shap_global(loaded)
                if method == "shap_tree"
                else engine.run_lime_global(loaded)
            )

        # Accord inter-méthodes [SHOULD] : global SHAP → comparer aux rangs LIME
        if (
            explanation.type.value == "global"
            and method == "shap_tree"
            and len(loaded.prepared.X_test) >= 10
        ):
            jobs_service.update_progress(
                db,
                uuid.UUID(job_id),
                progress=60,
                log_line="Comparaison SHAP ↔ LIME",
            )
            try:
                lime_result = engine.run_lime_global(loaded)
                agreement = xai_quality.inter_method_agreement(
                    result["values"]["ranking"], lime_result["values"]["ranking"]
                )
                if agreement:
                    result["kpis"]["inter_method_agreement"] = agreement
                    result["viz"]["method_comparison"] = {
                        "shap": result["values"]["importance"][:10],
                        "lime": lime_result["values"]["importance"][:10],
                    }
            except Exception:
                logger.info("xai.agreement_skipped", explanation_id=explanation_id)

        jobs_service.update_progress(
            db,
            uuid.UUID(job_id),
            progress=80,
            log_line="Rédaction de l'explication",
        )
        text = _generate_text(explanation, experiment, result)

        explanation.values = result["values"]
        explanation.viz_data = result["viz"]
        explanation.quality_kpis = result["kpis"]
        explanation.text_explanation = text["text"]
        explanation.model_used = text["model_used"]
        explanation.is_fallback = text["is_fallback"]
        explanation.tokens_used = text["tokens_used"]
        explanation.processing_seconds = round(time.perf_counter() - started, 2)  # MESURÉ
        explanation.status = ExplanationStatus.completed
        explanation.progress = 100
        db.commit()
        jobs_service.update_progress(
            db,
            uuid.UUID(job_id),
            status=JobStatus.completed,
            progress=100,
            log_line="Explication prête",
        )
        return "completed"
    except AppError as exc:
        _fail(db, explanation, job_id, exc.code, exc.message)
        return "failed"
    except Exception as exc:
        logger.exception("explain.failed", explanation_id=explanation_id)
        _fail(db, explanation, job_id, "XAI_FAILED", str(exc)[:300])
        return "failed"
    finally:
        db.close()


def _fail(db, explanation, job_id: str, code: str, message: str) -> None:  # type: ignore[no-untyped-def]
    if explanation is not None:
        explanation.status = ExplanationStatus.failed
        explanation.error_code = code
        explanation.error_message = message
        db.commit()
    with contextlib.suppress(Exception):
        jobs_service.update_progress(
            db, uuid.UUID(job_id), status=JobStatus.failed, error_code=code, message=message
        )


def _answer_chat_blocks(
    *,
    question: str,
    context: str,
    history: list[tuple[str, str]],
    language: str,
    metrics: dict,
    importance: list,
    task_type: str,
    algorithm: str,
    audience: str = "intermediate",
) -> dict:
    """Chat v2 : réponse en blocs validée + anti-hallucination, sinon fallback riche (P2).

    Boucle jusqu'à 2 tentatives LLM : une sortie invalide (JSON non conforme au schéma) OU
    citant un nombre absent du contexte est rejetée, puis on retente ; à l'échec on retombe
    sur un document déterministe (paragraphe + tableau des top-variables), badgé « sans IA ».

    `audience` (adaptatif §5.2) pilote le TON — LLM comme repli parlent au niveau de l'explication.
    """
    system = xai_text.chat_system_v2(language, audience)
    prompt = xai_text.chat_prompt_v2(
        question=question, context=context, history=history, language=language, audience=audience
    )
    try:
        for attempt in range(2):
            generated = llm_client.complete(
                system=system, user=prompt, max_tokens=700, json_mode=True
            )
            try:
                doc = xai_blocks.parse_document(generated.text)
            except Exception as exc:  # JSON/schéma invalide → on retente
                logger.info("xai_chat.invalid_blocks", attempt=attempt, reason=str(exc)[:200])
                continue
            if not xai_text.numbers_exist_in_context(xai_blocks.extract_text(doc), context):
                logger.info("xai_chat.hallucinated_number", attempt=attempt)
                continue
            return {
                "content": xai_blocks.to_plain_text(doc),
                "blocks": doc.model_dump(mode="json"),
                "model_used": generated.model_used,
                "is_fallback": False,
                "tokens_used": generated.tokens_used,
            }
        logger.info("xai_chat.fallback", reason="no_valid_answer")
    except llm_client.LLMUnavailable as exc:
        logger.info("xai_chat.fallback", reason=str(exc)[:200])

    doc = xai_blocks.fallback_document(
        language=language,
        metrics=metrics,
        importance=importance,
        task_type=task_type,
        algorithm=algorithm,
        audience=audience,
    )
    return {
        "content": xai_blocks.to_plain_text(doc),
        "blocks": doc.model_dump(mode="json"),
        "model_used": "fallback",
        "is_fallback": True,
        "tokens_used": 0,
    }


@celery_app.task(name="ibis.workers.tasks.explain.answer_chat_question", soft_time_limit=120)
def answer_chat_question(session_id: str, question: str) -> str:
    db = open_session()
    started = time.perf_counter()
    try:
        session = db.get(ChatSession, uuid.UUID(session_id))
        if session is None:
            return "skipped"
        explanation = db.get(Explanation, session.explanation_id)
        experiment = db.get(Experiment, explanation.experiment_id) if explanation else None
        if explanation is None or experiment is None:
            return "skipped"

        importance = (
            (explanation.values or {}).get("importance")
            or (explanation.values or {}).get("contributions")
            or []
        )
        context = xai_text.build_context(
            metrics=experiment.metrics or {},
            importance=importance,
            task_type=str(experiment.preprocessing_config.get("task_type", "")),
            algorithm=experiment.algorithm or "",
            explanation_type=explanation.type.value,
            local_values=explanation.values if explanation.type.value == "local" else None,
        )
        history = [
            (m.role, m.content)
            for m in db.scalars(
                __import__("sqlalchemy")
                .select(ChatMessage)
                .where(ChatMessage.session_id == session.id)
                .order_by(ChatMessage.created_at.asc())
            )
        ]
        payload = _answer_chat_blocks(
            question=question,
            context=context,
            history=history,
            language=session.language,
            metrics=experiment.metrics or {},
            importance=importance,
            task_type=str(experiment.preprocessing_config.get("task_type", "")),
            algorithm=experiment.algorithm or "",
            # Le chat parle au niveau de l'explication qu'il commente (adaptatif §5.2).
            audience=explanation.audience_level,
        )
        db.add(
            ChatMessage(
                session_id=session.id,
                role="assistant",
                response_seconds=round(time.perf_counter() - started, 2),
                **payload,
            )
        )
        session.last_activity = datetime.now(UTC).replace(tzinfo=None)
        db.commit()
        return "answered"
    finally:
        db.close()
