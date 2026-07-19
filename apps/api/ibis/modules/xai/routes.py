"""Routes XAI (CDC §9.7) : explications, instances de test, chat."""

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from ibis.db.engine import get_db
from ibis.modules.auth.deps import CurrentClaims, CurrentUser
from ibis.modules.auth.models import XaiAudience
from ibis.modules.experiments.service import get_experiment
from ibis.modules.llm.xai_text import humanize_feature, suggested_questions
from ibis.modules.xai import engine, fairness, service
from ibis.modules.xai.models import ExplanationStatus

router = APIRouter(tags=["xai"])

DbDep = Annotated[Session, Depends(get_db)]


class ExplanationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["global", "local"]
    method: Literal["auto", "shap", "lime"] = "auto"
    instance_index: int | None = Field(default=None, ge=0)
    language: Literal["fr", "en"] = "fr"
    # Niveau effectif « Voir en tant que » (adaptatif §5.1) : surcharge éphémère du profil pour
    # CETTE explication. None → on retombe sur user.xai_audience. Ne modifie jamais le profil.
    audience: XaiAudience | None = None


class ExplanationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    experiment_id: uuid.UUID
    type: str
    method_requested: str
    method_used: str | None
    method_justification: str | None
    audience_level: str
    language: str
    status: str
    progress: int
    job_id: uuid.UUID | None
    error_code: str | None
    error_message: str | None
    is_fallback: bool
    model_used: str | None
    processing_seconds: float | None
    created_at: datetime


class ExplanationResults(ExplanationRead):
    values: dict[str, Any] | None
    quality_kpis: dict[str, Any] | None
    viz_data: dict[str, Any] | None
    text_explanation: str | None
    instance_ref: dict[str, Any] | None


class ChatSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    explanation_id: uuid.UUID
    language: str
    questions_count: int
    max_questions: int
    is_active: bool


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    content: str
    # Réponse riche v2 (document de blocs typés) ; None pour les messages user / anciens.
    blocks: dict[str, Any] | None = None
    model_used: str | None
    is_fallback: bool
    created_at: datetime


class ChatAsk(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=1, max_length=500)


class ChatSessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    language: Literal["fr", "en"] = "fr"


@router.post(
    "/experiments/{experiment_id}/explanations",
    response_model=ExplanationRead,
    status_code=202,
    operation_id="requestExplanation",
)
def request_explanation(
    experiment_id: uuid.UUID, payload: ExplanationRequest, db: DbDep, user: CurrentUser
) -> ExplanationRead:
    """Explication asynchrone (job file xai) — 1 crédit (CDC §3.3)."""
    experiment = get_experiment(db, user.id, experiment_id)
    explanation = service.request_explanation(
        db,
        user,
        experiment,
        type_=payload.type,
        method=payload.method,
        instance_index=payload.instance_index,
        language=payload.language,
        audience=payload.audience,
    )
    return ExplanationRead.model_validate(explanation)


@router.get(
    "/experiments/{experiment_id}/explanations",
    response_model=list[ExplanationRead],
    operation_id="listExplanations",
)
def list_explanations(
    experiment_id: uuid.UUID, db: DbDep, claims: CurrentClaims
) -> list[ExplanationRead]:
    return [
        ExplanationRead.model_validate(e)
        for e in service.list_for_experiment(db, claims.user_id, experiment_id)
    ]


@router.get("/experiments/{experiment_id}/test-instances", operation_id="listTestInstances")
def list_test_instances(
    experiment_id: uuid.UUID,
    db: DbDep,
    claims: CurrentClaims,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=5, le=50)] = 10,
    sort_by_error: bool = True,
) -> dict[str, Any]:
    """Sélection d'instance CÔTÉ SERVEUR (préd/réel, tri par erreur) — CDC §9.2."""
    experiment = get_experiment(db, claims.user_id, experiment_id)
    loaded = engine.load_experiment_context(db, experiment)
    return engine.test_instances(
        loaded, page=page, page_size=page_size, sort_by_error=sort_by_error
    )


@router.get("/experiments/{experiment_id}/fairness", operation_id="getFairnessReport")
def get_fairness_report(
    experiment_id: uuid.UUID,
    db: DbDep,
    claims: CurrentClaims,
    sensitive_column: Annotated[str, Query(min_length=1)],
    favorable: str | None = None,
) -> dict[str, Any]:
    """Comparateur d'équité par attribut sensible — post-hoc, reproductible (P4).

    Recharge modèle + split déterministe, prédit sur le jeu de test et regroupe par la
    valeur brute de `sensitive_column`. N'est pas applicable en régression.
    """
    experiment = get_experiment(db, claims.user_id, experiment_id)
    loaded = engine.load_experiment_context(db, experiment)
    return fairness.fairness_report(loaded, sensitive_column=sensitive_column, favorable=favorable)


@router.get(
    "/explanations/{explanation_id}", response_model=ExplanationRead, operation_id="getExplanation"
)
def get_explanation(explanation_id: uuid.UUID, db: DbDep, claims: CurrentClaims) -> ExplanationRead:
    return ExplanationRead.model_validate(
        service.get_explanation(db, claims.user_id, explanation_id)
    )


@router.get(
    "/explanations/{explanation_id}/results",
    response_model=ExplanationResults,
    operation_id="getExplanationResults",
)
def get_explanation_results(
    explanation_id: uuid.UUID, db: DbDep, claims: CurrentClaims
) -> ExplanationResults:
    explanation = service.get_explanation(db, claims.user_id, explanation_id)
    if explanation.status != ExplanationStatus.completed:
        from ibis.core.errors import ConflictError

        raise ConflictError(
            f"Résultats indisponibles (statut : {explanation.status})", code="NOT_COMPLETED"
        )
    return ExplanationResults.model_validate(explanation)


@router.get(
    "/experiments/{experiment_id}/suggested-questions", operation_id="getSuggestedQuestions"
)
def get_suggested_questions(
    experiment_id: uuid.UUID,
    db: DbDep,
    claims: CurrentClaims,
    language: Annotated[str, Query(pattern="^(fr|en)$")] = "fr",
    audience: XaiAudience | None = None,
) -> list[str]:
    experiment = get_experiment(db, claims.user_id, experiment_id)
    # Contexte réel (CDC évolutions §4) : variable dominante de la DERNIÈRE explication
    # terminée (nom humanisé, colonne seule pour un one-hot) + métrique principale.
    top_feature: str | None = None
    latest = service.latest_completed_explanation(db, claims.user_id, experiment_id)
    if latest is not None:
        stored = latest.values or {}
        importance = stored.get("importance") or stored.get("contributions") or []
        if importance:
            label = humanize_feature(str(importance[0].get("feature", "")))
            top_feature = label.split(" = ")[0] or None
    metrics = experiment.metrics or {}
    primary = str(metrics.get("primary_metric", "")) or None
    # Niveau (adaptatif §5.2) : le novice reçoit des questions en langage courant.
    return suggested_questions(
        str(experiment.preprocessing_config.get("task_type", "classification")),
        language,
        audience.value if audience else None,
        top_feature=top_feature,
        metric_name=primary,
        metric_value=metrics.get(primary) if primary else None,
    )


# ------------------------------------ Chat ---------------------------------------------------


@router.post(
    "/explanations/{explanation_id}/chat",
    response_model=ChatSessionRead,
    status_code=201,
    operation_id="createChatSession",
)
def create_chat_session(
    explanation_id: uuid.UUID, payload: ChatSessionCreate, db: DbDep, user: CurrentUser
) -> ChatSessionRead:
    explanation = service.get_explanation(db, user.id, explanation_id)
    return ChatSessionRead.model_validate(
        service.create_chat_session(db, user, explanation, payload.language)
    )


@router.post(
    "/chat/{session_id}/messages",
    response_model=ChatSessionRead,
    status_code=202,
    operation_id="askChatQuestion",
)
def ask_chat_question(
    session_id: uuid.UUID, payload: ChatAsk, db: DbDep, user: CurrentUser
) -> ChatSessionRead:
    """Question → job LLM asynchrone ([NE PAS REPRODUIRE] X9 : jamais bloquant)."""
    session = service.get_chat_session(db, user.id, session_id)
    service.ask_question(db, user, session, payload.question)
    return ChatSessionRead.model_validate(session)


@router.get(
    "/chat/{session_id}/messages",
    response_model=list[ChatMessageRead],
    operation_id="listChatMessages",
)
def list_chat_messages(
    session_id: uuid.UUID, db: DbDep, claims: CurrentClaims
) -> list[ChatMessageRead]:
    session = service.get_chat_session(db, claims.user_id, session_id)
    return [ChatMessageRead.model_validate(m) for m in service.chat_messages(db, session)]
