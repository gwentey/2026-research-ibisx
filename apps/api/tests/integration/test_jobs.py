"""Intégration : cycle de vie d'un job (BDD source de vérité, polling)."""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from ibis.modules.jobs import service
from ibis.modules.jobs.models import JobKind, JobStatus


def test_job_lifecycle_via_service_and_api(client: TestClient, db_session: Session) -> None:
    job = service.create_job(db_session, kind=JobKind.maintenance, queue="maintenance")

    response = client.get(f"/api/v1/jobs/{job.id}")
    assert response.status_code == 200
    assert response.json()["status"] == "pending"
    assert response.json()["progress"] == 0

    service.update_progress(db_session, job.id, status=JobStatus.running, progress=40)
    body = client.get(f"/api/v1/jobs/{job.id}").json()
    assert body["status"] == "running"
    assert body["progress"] == 40

    service.update_progress(db_session, job.id, status=JobStatus.completed, progress=100)
    body = client.get(f"/api/v1/jobs/{job.id}").json()
    assert body["status"] == "completed"
    assert body["finished_at"] is not None


def test_job_progress_is_clamped(db_session: Session) -> None:
    job = service.create_job(db_session, kind=JobKind.maintenance, queue="maintenance")
    service.update_progress(db_session, job.id, progress=250)
    assert service.get_job(db_session, job.id).progress == 100
    service.update_progress(db_session, job.id, progress=-5)
    assert service.get_job(db_session, job.id).progress == 0


def test_unknown_job_404(client: TestClient) -> None:
    response = client.get(f"/api/v1/jobs/{uuid.uuid4()}")
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "JOB_NOT_FOUND"


def test_sse_endpoint_returns_initial_state_for_terminal_job(
    client: TestClient, db_session: Session
) -> None:
    """Un job terminal renvoie son état initial et ferme le flux immédiatement."""
    job = service.create_job(db_session, kind=JobKind.maintenance, queue="maintenance")
    service.update_progress(db_session, job.id, status=JobStatus.completed, progress=100)

    with client.stream("GET", f"/api/v1/jobs/{job.id}/events") as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        content = "".join(response.iter_text())
    assert '"status": "completed"' in content or '"status":"completed"' in content
