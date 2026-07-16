"""Service jobs : création, progression (BDD = source de vérité + pub/sub temps réel).

Le worker écrit TOUJOURS la progression en base d'abord (durable), puis publie
l'événement sur Redis pour le SSE (ARCH §5.4). En cas d'indisponibilité du pub/sub,
le polling reste exact.
"""

import contextlib
import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ibis.core.errors import NotFoundError
from ibis.core.redis import get_sync_redis, job_channel
from ibis.modules.jobs.models import Job, JobKind, JobStatus
from ibis.modules.jobs.schemas import JobEvent


def create_job(
    db: Session,
    *,
    kind: JobKind,
    queue: str,
    user_id: uuid.UUID | None = None,
    ref_id: uuid.UUID | None = None,
) -> Job:
    job = Job(kind=kind, queue=queue, user_id=user_id, ref_id=ref_id)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, job_id: uuid.UUID) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise NotFoundError(f"Job {job_id} introuvable", code="JOB_NOT_FOUND")
    return job


def publish_event(event: JobEvent) -> None:
    """Publication temps réel — best effort : le polling reste la source fiable."""
    with contextlib.suppress(Exception):
        get_sync_redis().publish(job_channel(str(event.job_id)), event.model_dump_json())


def update_progress(
    db: Session,
    job_id: uuid.UUID,
    *,
    progress: int | None = None,
    status: JobStatus | None = None,
    log_line: str | None = None,
    error_code: str | None = None,
    message: str | None = None,
) -> Job:
    job = get_job(db, job_id)
    now = datetime.now(UTC)

    if status is not None and status != job.status:
        job.status = status
        if status == JobStatus.running and job.started_at is None:
            job.started_at = now
        if status.is_terminal:
            job.finished_at = now
    if progress is not None:
        job.progress = max(0, min(100, progress))
    if error_code is not None:
        job.error_code = error_code
    if message is not None:
        job.message = message[:512]

    db.commit()

    publish_event(
        JobEvent(
            job_id=job.id,
            status=job.status,
            progress=job.progress,
            log_line=log_line,
            error_code=job.error_code,
        )
    )
    return job
