"""Schemas Pydantic du module jobs."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from ibis.modules.jobs.models import JobKind, JobStatus


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: JobKind
    status: JobStatus
    user_id: uuid.UUID | None
    ref_id: uuid.UUID | None
    queue: str
    progress: int
    error_code: str | None
    message: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class JobEvent(BaseModel):
    """Payload publié sur Redis pub/sub et poussé en SSE."""

    job_id: uuid.UUID
    status: JobStatus
    progress: int
    log_line: str | None = None
    error_code: str | None = None
