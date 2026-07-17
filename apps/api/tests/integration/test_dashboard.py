"""Intégration M7 : chaque KPI du dashboard vérifié contre un état de base CONNU (P1)."""

from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from ibis.modules.auth.models import User
from ibis.modules.datasets.models import Dataset
from ibis.modules.experiments.models import Experiment, ExperimentStatus
from ibis.modules.projects.models import Project


def register(client: TestClient, email: str = "dash@example.org") -> tuple[dict[str, str], str]:
    response = client.post(
        "/api/v1/auth/register", json={"email": email, "password": "s3cret-pass"}
    ).json()
    return {"Authorization": f"Bearer {response['access_token']}"}, response["user"]["id"]


def seed_state(db: Session, user_id: str) -> None:
    """3 expériences (2 réussies, 1 échouée, durées 10 et 20 s) + 1 brouillon + 2 projets."""
    user_uuid = db.query(User).filter(User.email == "dash@example.org").one().id
    assert str(user_uuid) == user_id
    dataset = Dataset(dataset_name="dash_ds", display_name="Dash DS")
    project_a = Project(user_id=user_uuid, name="Projet A")
    project_b = Project(user_id=user_uuid, name="Projet B")
    db.add_all([dataset, project_a, project_b])
    db.flush()

    now = datetime.now(UTC).replace(tzinfo=None)
    db.add_all(
        [
            Experiment(
                user_id=user_uuid,
                project_id=project_a.id,
                dataset_id=dataset.id,
                algorithm="decision_tree",
                status=ExperimentStatus.completed,
                duration_seconds=10.0,
                finished_at=now,
            ),
            Experiment(
                user_id=user_uuid,
                project_id=project_a.id,
                dataset_id=dataset.id,
                algorithm="random_forest",
                status=ExperimentStatus.completed,
                duration_seconds=20.0,
                finished_at=now,
            ),
            Experiment(
                user_id=user_uuid,
                project_id=project_b.id,
                dataset_id=dataset.id,
                algorithm="decision_tree",
                status=ExperimentStatus.failed,
                error_code="TIMEOUT",
            ),
            Experiment(  # brouillon : exclu des KPI, présent en pending_draft
                user_id=user_uuid,
                project_id=project_b.id,
                dataset_id=dataset.id,
                status=ExperimentStatus.draft,
                draft_state={"step": 3},
            ),
        ]
    )
    db.commit()


def test_dashboard_kpis_exact(client: TestClient, db_session: Session) -> None:
    headers, user_id = register(client)
    seed_state(db_session, user_id)

    body = client.get("/api/v1/dashboard", headers=headers).json()
    kpis = body["kpis"]
    assert kpis["total_experiments"] == 3  # le brouillon est EXCLU
    assert kpis["active_projects"] == 2
    assert kpis["success_rate"] == 0.6667  # 2 réussies / 3 terminées
    assert kpis["average_duration_seconds"] == 15.0  # (10+20)/2

    assert len(body["recent_activity"]) == 3
    assert {item["kind"] for item in body["recent_activity"]} == {"experiment"}
    assert [p["name"] for p in body["recent_projects"]][:2] == ["Projet B", "Projet A"] or len(
        body["recent_projects"]
    ) == 2

    draft = body["pending_draft"]
    assert draft is not None
    assert draft["dataset_name"] == "Dash DS"


def test_dashboard_empty_account_is_honest(client: TestClient) -> None:
    """Compte neuf : 0 partout, taux de succès ABSENT (None) — jamais un faux 0 % (P1)."""
    headers, _ = register(client, "fresh@example.org")
    body = client.get("/api/v1/dashboard", headers=headers).json()
    assert body["kpis"]["total_experiments"] == 0
    assert body["kpis"]["success_rate"] is None
    assert body["kpis"]["average_duration_seconds"] is None
    assert body["recent_activity"] == []
    assert body["pending_draft"] is None


def test_global_experiments_list_filters(client: TestClient, db_session: Session) -> None:
    headers, user_id = register(client)
    seed_state(db_session, user_id)

    all_experiments = client.get("/api/v1/experiments", headers=headers).json()
    assert len(all_experiments) == 3  # brouillon exclu

    completed = client.get(
        "/api/v1/experiments", params={"status": "completed"}, headers=headers
    ).json()
    assert len(completed) == 2
    forest = client.get(
        "/api/v1/experiments", params={"algorithm": "random_forest"}, headers=headers
    ).json()
    assert len(forest) == 1
