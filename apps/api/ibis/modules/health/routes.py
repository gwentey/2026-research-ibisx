"""Endpoints de santé (ARCH §12) : liveness DB + Redis + volume, heartbeat worker."""

import tempfile
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ibis.core.config import Settings, get_settings
from ibis.core.redis import get_sync_redis
from ibis.db.engine import get_db

router = APIRouter(prefix="/health", tags=["health"])

CheckStatus = Literal["ok", "error"]


class HealthReport(BaseModel):
    status: Literal["ok", "degraded"]
    database: CheckStatus
    redis: CheckStatus
    storage: CheckStatus
    version: str


class WorkerHealthReport(BaseModel):
    status: Literal["ok", "unavailable"]
    workers: list[str]


def _check_storage(data_dir: str) -> CheckStatus:
    try:
        base = Path(data_dir)
        base.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=base, prefix=".healthcheck-"):
            pass
        return "ok"
    except OSError:
        return "error"


@router.get("", response_model=HealthReport, operation_id="getHealth")
def get_health(
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> HealthReport:
    from ibis import __version__

    try:
        db.execute(text("SELECT 1"))
        database: CheckStatus = "ok"
    except Exception:
        database = "error"

    try:
        redis_ok: CheckStatus = "ok" if get_sync_redis().ping() else "error"
    except Exception:
        redis_ok = "error"

    storage = _check_storage(settings.data_dir)

    checks = (database, redis_ok, storage)
    status: Literal["ok", "degraded"] = "ok" if all(c == "ok" for c in checks) else "degraded"
    if status != "ok":
        response.status_code = 503
    return HealthReport(
        status=status, database=database, redis=redis_ok, storage=storage, version=__version__
    )


@router.get("/worker", response_model=WorkerHealthReport, operation_id="getWorkerHealth")
def get_worker_health(response: Response) -> WorkerHealthReport:
    from ibis.workers.celery_app import celery_app

    try:
        replies = celery_app.control.inspect(timeout=1.0).ping() or {}
    except Exception:
        replies = {}
    workers = sorted(replies.keys())
    if not workers:
        response.status_code = 503
        return WorkerHealthReport(status="unavailable", workers=[])
    return WorkerHealthReport(status="ok", workers=workers)
