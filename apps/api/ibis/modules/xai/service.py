"""Service XAI : cycle de vie des explications + chat (quotas, crédits, honnêteté)."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ibis.core.config import get_settings
from ibis.core.errors import AppError, ConflictError, NotFoundError, QuotaExceededError
from ibis.modules.auth.models import User, XaiAudience
from ibis.modules.experiments.models import Experiment, ExperimentStatus
from ibis.modules.experiments.service import get_experiment
from ibis.modules.jobs import service as jobs_service
from ibis.modules.jobs.models import JobKind
from ibis.modules.xai.models import (
    ChatMessage,
    ChatSession,
    Explanation,
    ExplanationStatus,
    ExplanationType,
)


def get_explanation(db: Session, user_id: uuid.UUID, explanation_id: uuid.UUID) -> Explanation:
    explanation = db.scalar(
        select(Explanation).where(Explanation.id == explanation_id, Explanation.user_id == user_id)
    )
    if explanation is None:
        raise NotFoundError("Explication introuvable", code="EXPLANATION_NOT_FOUND")
    return explanation


def request_explanation(
    db: Session,
    user: User,
    experiment: Experiment,
    *,
    type_: str,
    method: str,
    instance_index: int | None,
    language: str,
    audience: XaiAudience | None = None,
) -> Explanation:
    if experiment.status != ExperimentStatus.completed:
        raise ConflictError("L'expérience doit être terminée", code="NOT_COMPLETED")
    if type_ == "local" and instance_index is None:
        raise ConflictError("Sélectionnez une instance de test", code="INSTANCE_REQUIRED")
    if user.credits < 1:
        raise AppError(
            "Crédits insuffisants — demandez une recharge à un administrateur",
            code="INSUFFICIENT_CREDITS",
            status_code=402,
        )
    user.credits -= 1  # 1 explication LLM = 1 crédit (CDC §3.3)

    explanation = Explanation(
        user_id=user.id,
        experiment_id=experiment.id,
        type=ExplanationType(type_ if type_ != "global" else "global"),
        method_requested=method,
        # Niveau effectif : la surcharge (« Voir en tant que ») prime sur le profil, sinon profil.
        # Éphémère : on ne touche pas à user.xai_audience (adaptatif §5.1, décision D1).
        audience_level=(audience or user.xai_audience).value,
        language=language,
        instance_ref={"index": instance_index} if instance_index is not None else None,
    )
    db.add(explanation)
    db.flush()
    job = jobs_service.create_job(
        db, kind=JobKind.explanation, queue="xai", user_id=user.id, ref_id=explanation.id
    )
    explanation.job_id = job.id
    db.commit()
    db.refresh(explanation)

    from ibis.workers.tasks.explain import generate_explanation

    generate_explanation.apply_async(args=[str(explanation.id), str(job.id)], queue="xai")
    return explanation


def list_for_experiment(
    db: Session, user_id: uuid.UUID, experiment_id: uuid.UUID
) -> list[Explanation]:
    get_experiment(db, user_id, experiment_id)
    return list(
        db.scalars(
            select(Explanation)
            .where(Explanation.experiment_id == experiment_id, Explanation.user_id == user_id)
            .order_by(Explanation.created_at.desc())
        )
    )


def latest_completed_explanation(
    db: Session, user_id: uuid.UUID, experiment_id: uuid.UUID
) -> Explanation | None:
    """Dernière explication TERMINÉE de l'expérience — source des questions suggérées
    contextualisées (CDC évolutions §4 : citer la vraie variable dominante)."""
    return db.scalars(
        select(Explanation)
        .where(
            Explanation.experiment_id == experiment_id,
            Explanation.user_id == user_id,
            Explanation.status == ExplanationStatus.completed,
        )
        .order_by(Explanation.created_at.desc())
        .limit(1)
    ).first()


# ------------------------------------ Chat ---------------------------------------------------


def create_chat_session(
    db: Session, user: User, explanation: Explanation, language: str
) -> ChatSession:
    if explanation.status != ExplanationStatus.completed:
        raise ConflictError("L'explication doit être terminée", code="NOT_COMPLETED")
    settings = get_settings()
    session = ChatSession(
        explanation_id=explanation.id,
        user_id=user.id,
        language=language,
        max_questions=settings.max_chat_questions,
        last_activity=datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_chat_session(db: Session, user_id: uuid.UUID, session_id: uuid.UUID) -> ChatSession:
    session = db.scalar(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    )
    if session is None:
        raise NotFoundError("Session de chat introuvable", code="CHAT_SESSION_NOT_FOUND")
    return session


def ask_question(db: Session, user: User, session: ChatSession, question: str) -> ChatMessage:
    settings = get_settings()
    if not session.is_active:
        raise ConflictError("Session de chat expirée", code="CHAT_SESSION_EXPIRED")
    if session.questions_count >= session.max_questions:
        raise QuotaExceededError(
            f"Maximum {session.max_questions} questions par session (CDC §3.3)",
            code="MAX_CHAT_QUESTIONS",
        )
    if len(question) > 500:
        raise ConflictError("Question trop longue (500 caractères max)", code="QUESTION_TOO_LONG")

    session.questions_count += 1
    session.last_activity = datetime.now(UTC).replace(tzinfo=None)
    message = ChatMessage(session_id=session.id, role="user", content=question)
    db.add(message)
    db.commit()
    db.refresh(message)

    from ibis.workers.tasks.explain import answer_chat_question

    answer_chat_question.apply_async(args=[str(session.id), question], queue="llm")
    _ = settings
    return message


def chat_messages(db: Session, session: ChatSession) -> list[ChatMessage]:
    return list(
        db.scalars(
            select(ChatMessage)
            .where(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.created_at.asc())
        )
    )


def purge_expired_chat_sessions(db: Session) -> int:
    """Sessions inactives depuis 24 h → désactivées (tâche beat, ADR-004)."""
    settings = get_settings()
    threshold = datetime.now(UTC).replace(tzinfo=None) - timedelta(
        hours=settings.chat_session_timeout_hours
    )
    stale = db.scalars(
        select(ChatSession).where(
            ChatSession.is_active.is_(True), ChatSession.last_activity < threshold
        )
    ).all()
    for session in stale:
        session.is_active = False
    db.commit()
    return len(stale)


def count_active_explanations(db: Session, experiment_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count(Explanation.id)).where(
                Explanation.experiment_id == experiment_id,
                Explanation.status.in_((ExplanationStatus.pending, ExplanationStatus.running)),
            )
        )
        or 0
    )
