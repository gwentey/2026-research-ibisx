"""Modèles XAI (ARCH §6.2) : explanations, chat_sessions, chat_messages."""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, Float, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ibis.db.base import Base, Timestamped, UUIDPk


class ExplanationType(enum.StrEnum):
    global_ = "global"
    local = "local"


class ExplanationStatus(enum.StrEnum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"

    @property
    def is_terminal(self) -> bool:
        return self in (ExplanationStatus.completed, ExplanationStatus.failed)


class Explanation(UUIDPk, Timestamped, Base):
    __tablename__ = "explanations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    experiment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("experiments.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[ExplanationType] = mapped_column(
        SAEnum(
            ExplanationType,
            name="explanation_type",
            values_callable=lambda e: [m.value for m in e],
        )
    )
    method_requested: Mapped[str] = mapped_column(String(20), default="auto")
    method_used: Mapped[str | None] = mapped_column(String(30))  # shap_tree|lime|…
    method_justification: Mapped[str | None] = mapped_column(String(255))
    audience_level: Mapped[str] = mapped_column(String(20), default="novice")
    language: Mapped[str] = mapped_column(String(5), default="fr")
    instance_ref: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # sélection SERVEUR
    status: Mapped[ExplanationStatus] = mapped_column(
        SAEnum(
            ExplanationStatus,
            name="explanation_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=ExplanationStatus.pending,
        index=True,
    )
    progress: Mapped[int] = mapped_column(SmallInteger, default=0)
    job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(Text)
    values: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # SHAP/LIME + métadonnées seeds
    quality_kpis: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # KPI CALCULÉS ou absents
    viz_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    text_explanation: Mapped[str | None] = mapped_column(Text)
    model_used: Mapped[str | None] = mapped_column(String(120))
    is_fallback: Mapped[bool] = mapped_column(Boolean, default=False)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    processing_seconds: Mapped[float | None] = mapped_column(Float)  # MESURÉ, pas hardcodé


class ChatSession(UUIDPk, Timestamped, Base):
    __tablename__ = "chat_sessions"

    explanation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("explanations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    language: Mapped[str] = mapped_column(String(5), default="fr")
    questions_count: Mapped[int] = mapped_column(Integer, default=0)
    max_questions: Mapped[int] = mapped_column(Integer, default=5)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_activity: Mapped[datetime | None] = mapped_column()


class ChatMessage(UUIDPk, Base):
    __tablename__ = "chat_messages"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(10))  # user|assistant
    content: Mapped[str] = mapped_column(Text)  # miroir texte (copie, recherche, a11y, repli)
    blocks: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # réponse riche v2 (BlockDocument)
    model_used: Mapped[str | None] = mapped_column(String(120))
    is_fallback: Mapped[bool] = mapped_column(Boolean, default=False)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    response_seconds: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(server_default="now()")
