"""Routes jobs : polling, SSE temps réel (ADR-007), déclencheur de démonstration."""

import asyncio
import contextlib
import json
import uuid
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from ibis.core.config import Settings, get_settings
from ibis.core.errors import NotFoundError
from ibis.core.redis import get_async_redis, job_channel
from ibis.db.engine import get_db
from ibis.modules.jobs import service
from ibis.modules.jobs.models import JobKind, JobStatus
from ibis.modules.jobs.schemas import JobRead

router = APIRouter(prefix="/jobs", tags=["jobs"])

SSE_HEARTBEAT_SECONDS = 15.0


@router.get("/{job_id}", response_model=JobRead, operation_id="getJob")
def get_job(job_id: uuid.UUID, db: Session = Depends(get_db)) -> JobRead:
    """Statut d'un job (repli polling — toujours disponible, ADR-007)."""
    return JobRead.model_validate(service.get_job(db, job_id))


@router.get("/{job_id}/events", operation_id="streamJobEvents")
async def stream_job_events(
    job_id: uuid.UUID, request: Request, db: Session = Depends(get_db)
) -> EventSourceResponse:
    """Flux SSE de progression d'un job : état courant immédiat, puis pub/sub Redis.

    Se termine de lui-même quand le job atteint un statut terminal.
    """
    job = service.get_job(db, job_id)
    initial = {
        "job_id": str(job.id),
        "status": job.status.value,
        "progress": job.progress,
        "log_line": None,
        "error_code": job.error_code,
    }
    already_terminal = job.status.is_terminal

    async def event_stream() -> AsyncGenerator[dict[str, str], None]:
        yield {"event": "progress", "data": json.dumps(initial)}
        if already_terminal:
            return

        redis = get_async_redis()
        pubsub = redis.pubsub()
        await pubsub.subscribe(job_channel(str(job_id)))
        try:
            while not await request.is_disconnected():
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=SSE_HEARTBEAT_SECONDS
                )
                if message is None:
                    yield {"event": "heartbeat", "data": ""}
                    continue
                payload = json.loads(message["data"])
                yield {"event": "progress", "data": json.dumps(payload)}
                if JobStatus(payload["status"]).is_terminal:
                    return
        finally:
            with contextlib.suppress(Exception):
                await pubsub.unsubscribe(job_channel(str(job_id)))
                await pubsub.aclose()

    return EventSourceResponse(event_stream())


@router.post("/smoke", response_model=JobRead, status_code=201, operation_id="startSmokeJob")
def start_smoke_job(
    db: Session = Depends(get_db), settings: Settings = Depends(get_settings)
) -> JobRead:
    """Job de démonstration du socle (progression 0→100 via le worker).

    Indisponible en production — sert uniquement à prouver la chaîne
    API → file → worker → BDD/pub-sub → SSE (JALONS.md J0).
    """
    if settings.is_production:
        raise NotFoundError("Not found")
    job = service.create_job(db, kind=JobKind.maintenance, queue="maintenance")
    from ibis.workers.tasks.smoke import smoke_task

    smoke_task.apply_async(args=[str(job.id)], queue="maintenance")
    return JobRead.model_validate(job)


async def _unused() -> None:  # pragma: no cover
    await asyncio.sleep(0)
