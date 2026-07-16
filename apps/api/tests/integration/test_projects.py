"""Intégration M4 : CRUD projets, isolation stricte, normalisation des poids, recommandations."""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from ibis.modules.datasets.models import Dataset


def register(client: TestClient, email: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register", json={"email": email, "password": "s3cret-pass"}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def make_project(client: TestClient, headers: dict[str, str], **overrides: object) -> dict:
    payload = {
        "name": "Détection du décrochage",
        "description": "Identifier les élèves à risque",
        "criteria": {"domains": ["education"]},
        "weights": {"ethical_score": 0.5, "technical_score": 0.5},
        **overrides,
    }
    response = client.post("/api/v1/projects", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_crud_and_isolation(client: TestClient) -> None:
    alice = register(client, "alice@example.org")
    bob = register(client, "bob@example.org")

    project = make_project(client, alice)
    project_id = project["id"]
    assert project["active_criteria_count"] == 1

    # Bob ne VOIT pas le projet d'Alice (404, pas 403 : il est introuvable pour lui)
    assert client.get(f"/api/v1/projects/{project_id}", headers=bob).status_code == 404
    assert (
        client.put(
            f"/api/v1/projects/{project_id}",
            json={"name": "hack", "criteria": {}, "weights": {}},
            headers=bob,
        ).status_code
        == 404
    )
    assert client.delete(f"/api/v1/projects/{project_id}", headers=bob).status_code == 404
    assert client.get("/api/v1/projects", headers=bob).json()["total"] == 0

    # Alice modifie et liste
    updated = client.put(
        f"/api/v1/projects/{project_id}",
        json={
            "name": "Décrochage v2",
            "criteria": {"domains": ["education"], "ethical_score_min": 30},
            "weights": {"ethical_score": 1.0},
        },
        headers=alice,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Décrochage v2"
    assert updated.json()["active_criteria_count"] == 2

    page = client.get("/api/v1/projects", params={"q": "décrochage"}, headers=alice).json()
    assert page["total"] == 1

    assert client.delete(f"/api/v1/projects/{project_id}", headers=alice).status_code == 204
    assert client.get(f"/api/v1/projects/{project_id}", headers=alice).status_code == 404


def test_weights_normalized_when_sum_exceeds_one(client: TestClient) -> None:
    headers = register(client, "norm@example.org")
    project = make_project(client, headers, weights={"ethical_score": 0.8, "technical_score": 0.8})
    # Σ = 1.6 > 1 → normalisation automatique (CDC §7.2)
    assert project["weights"] == {"ethical_score": 0.5, "technical_score": 0.5}

    kept = make_project(client, headers, name="Poids conservés", weights={"ethical_score": 0.3})
    assert kept["weights"] == {"ethical_score": 0.3}  # Σ ≤ 1 → inchangé


def test_validation_rejects_unknown_criterion_or_filter(client: TestClient) -> None:
    headers = register(client, "valid@example.org")
    bad_weight = client.post(
        "/api/v1/projects",
        json={"name": "X", "criteria": {}, "weights": {"vibes": 0.5}},
        headers=headers,
    )
    assert bad_weight.status_code == 422
    bad_filter = client.post(
        "/api/v1/projects",
        json={"name": "X", "criteria": {"nope": 1}, "weights": {}},
        headers=headers,
    )
    assert bad_filter.status_code == 422


def test_recommendations_match_score_endpoint(client: TestClient, db_session: Session) -> None:
    """Cohérence P3 : recommandations du projet = POST /datasets/score à paramètres égaux."""
    db_session.add(
        Dataset(
            dataset_name="edu_a",
            display_name="Edu A",
            domain=["education"],
            transparency=True,
            informed_consent=True,
            split=True,
            instances_number=5000,
            features_number=20,
        )
    )
    db_session.add(
        Dataset(
            dataset_name="edu_b",
            display_name="Edu B",
            domain=["education"],
            transparency=True,
            instances_number=200,
            features_number=5,
        )
    )
    db_session.add(Dataset(dataset_name="fin", display_name="Fin", domain=["finance"]))
    db_session.commit()

    headers = register(client, "reco@example.org")
    project = make_project(
        client,
        headers,
        criteria={"domains": ["education"]},
        weights={"ethical_score": 0.6, "technical_score": 0.4},
    )

    reco = client.get(f"/api/v1/projects/{project['id']}/recommendations", headers=headers).json()
    direct = client.post(
        "/api/v1/datasets/score",
        json={
            "filters": {"domains": ["education"]},
            "weights": [
                {"criterion_name": "ethical_score", "weight": 0.6},
                {"criterion_name": "technical_score", "weight": 0.4},
            ],
        },
        headers=headers,
    ).json()

    assert [r["dataset"]["dataset_name"] for r in reco["results"]] == ["edu_a", "edu_b"]
    assert reco["results"] == direct["results"]  # strictement identiques (P3/P4)


def test_recommendations_of_missing_project_404(client: TestClient) -> None:
    headers = register(client, "ghost@example.org")
    response = client.get(f"/api/v1/projects/{uuid.uuid4()}/recommendations", headers=headers)
    assert response.status_code == 404
