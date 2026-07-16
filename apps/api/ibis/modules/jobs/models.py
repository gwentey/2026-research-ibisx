"""Table `jobs` — vue de supervision unique de tout travail asynchrone (ARCH §6.2).

Alimentée par le worker ; lue par le SSE, le polling et l'admin (M8).
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Enum as SAEnum
from sqlalchemy import SmallInteger, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ibis.db.base import Base, Timestamped, UUIDPk


class JobKind(enum.StrEnum):
    training = "training"
    explanation = "explanation"
    chat = "chat"
    import_ = "import"
    guide = "guide"
    maintenance = "maintenance"


class JobStatus(enum.StrEnum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"

    @property
    def is_terminal(self) -> bool:
        return self in (JobStatus.completed, JobStatus.failed, JobStatus.cancelled)


class Job(UUIDPk, Timestamped, Base):
    __tablename__ = "jobs"

    kind: Mapped[JobKind] = mapped_column(
        SAEnum(JobKind, name="job_kind", values_callable=lambda e: [m.value for m in e])
    )
    status: Mapped[JobStatus] = mapped_column(
        SAEnum(JobStatus, name="job_status", values_callable=lambda e: [m.value for m in e]),
        default=JobStatus.pending,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    ref_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    queue: Mapped[str] = mapped_column(String(32), default="maintenance")
    progress: Mapped[int] = mapped_column(SmallInteger, default=0)
    error_code: Mapped[str | None] = mapped_column(String(64))
    message: Mapped[str | None] = mapped_column(String(512))
    started_at: Mapped[datetime | None] = mapped_column()
    finished_at: Mapped[datetime | None] = mapped_column()
