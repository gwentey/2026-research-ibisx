"""Modèles expériences (ARCH §6.2) — le statut draft porte la reprise du wizard (P5)."""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float, ForeignKey, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ibis.db.base import Base, Timestamped, UUIDPk


class ExperimentStatus(enum.StrEnum):
    draft = "draft"
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"

    @property
    def is_terminal(self) -> bool:
        return self in (
            ExperimentStatus.completed,
            ExperimentStatus.failed,
            ExperimentStatus.cancelled,
        )


class Experiment(UUIDPk, Timestamped, Base):
    __tablename__ = "experiments"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    dataset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="CASCADE"), index=True
    )
    algorithm: Mapped[str | None] = mapped_column(String(50))
    hyperparameters: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    preprocessing_config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    status: Mapped[ExperimentStatus] = mapped_column(
        SAEnum(
            ExperimentStatus,
            name="experiment_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=ExperimentStatus.draft,
        index=True,
    )
    progress: Mapped[int] = mapped_column(SmallInteger, default=0)
    job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    task_id: Mapped[str | None] = mapped_column(String(155))  # id Celery (annulation)
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(Text)
    metrics: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    viz_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # DONNÉES, pas d'images
    feature_importance: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)
    applied_preprocessing: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # honnêteté T1
    artifact_key: Mapped[str | None] = mapped_column(String(512))
    draft_state: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # reprise wizard
    started_at: Mapped[datetime | None] = mapped_column()
    finished_at: Mapped[datetime | None] = mapped_column()
    duration_seconds: Mapped[float | None] = mapped_column(Float)


class ExperimentLog(UUIDPk, Base):
    __tablename__ = "experiment_logs"

    experiment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("experiments.id", ondelete="CASCADE"), index=True
    )
    ts: Mapped[datetime] = mapped_column(server_default="now()")
    level: Mapped[str] = mapped_column(String(10), default="info")
    message: Mapped[str] = mapped_column(String(512))
