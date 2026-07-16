"""Intégration : POST /datasets/score (classement, décomposition, cohérence P3, perf)."""

import time

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from ibis.modules.datasets.models import Dataset


def seed_dataset(db: Session, name: str, **fields: object) -> Dataset:
    dataset = Dataset(dataset_name=name, display_name=name.title(), **fields)
    db.add(dataset)
    db.commit()
    return dataset


def auth(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register", json={"email": "scorer@example.org", "password": "s3cret-pass"}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_score_ranking_and_decomposition(client: TestClient, db_session: Session) -> None:
    seed_dataset(
        db_session,
        "ethique_forte",
        transparency=True,
        informed_consent=True,
        anonymization_applied=True,
        user_control=True,
        equity_non_discrimination=True,  # 5/10 éthique
        split=True,
        instances_number=100_000,
        features_number=50,
        has_missing_values=False,
    )
    seed_dataset(
        db_session,
        "technique_faible",
        transparency=True,  # 1/10 éthique
        split=False,
        instances_number=50,
        features_number=3,
        has_missing_values=True,
        global_missing_percentage=40.0,
    )
    headers = auth(client)

    response = client.post(
        "/api/v1/datasets/score",
        json={"weights": [{"criterion_name": "ethical_score", "weight": 1.0}]},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert [r["rank"] for r in body["results"]] == [1, 2]
    assert body["results"][0]["dataset"]["dataset_name"] == "ethique_forte"
    assert body["results"][0]["score"] == 0.5  # 5/10 — poids unique éthique
    assert set(body["results"][0]["criterion_scores"]) == set(body["criteria"])
    # Cohérence P3 : le score éthique de la carte = celui de la décomposition
    assert (
        body["results"][0]["dataset"]["ethical_score"]
        == (body["results"][0]["criterion_scores"]["ethical_score"])
    )
    assert body["effective_weights"] == {"ethical_score": 1.0}


def test_score_default_weights_and_filters(client: TestClient, db_session: Session) -> None:
    seed_dataset(db_session, "edu", domain=["education"], transparency=True)
    seed_dataset(db_session, "sante", domain=["healthcare"], transparency=True)
    headers = auth(client)

    filtered = client.post(
        "/api/v1/datasets/score",
        json={"filters": {"domains": ["education"]}, "weights": []},
        headers=headers,
    ).json()
    assert [r["dataset"]["dataset_name"] for r in filtered["results"]] == ["edu"]
    # Poids par défaut : éthique 0.4 / technique 0.4 / popularité 0.2
    assert filtered["effective_weights"] == {
        "ethical_score": 0.4,
        "technical_score": 0.4,
        "popularity_score": 0.2,
    }


def test_unknown_criterion_rejected(client: TestClient) -> None:
    headers = auth(client)
    response = client.post(
        "/api/v1/datasets/score",
        json={"weights": [{"criterion_name": "vibes", "weight": 1.0}]},
        headers=headers,
    )
    assert response.status_code == 422


def test_profiles_endpoint(client: TestClient) -> None:
    headers = auth(client)
    body = client.get("/api/v1/score/profiles", headers=headers).json()
    names = {p["name"] for p in body["profiles"]}
    assert names == {"academic_research", "industrial_application", "rapid_prototyping"}
    assert body["default_weights"]["ethical_score"] == 0.4
    assert len(body["criteria"]) == 12


def test_scoring_100_datasets_under_one_second(client: TestClient, db_session: Session) -> None:
    """CDC §12.2 : scoring de 100 datasets avec décomposition < 1 s."""
    for index in range(100):
        db_session.add(
            Dataset(
                dataset_name=f"bulk_{index}",
                display_name=f"Bulk {index}",
                transparency=index % 2 == 0,
                split=index % 3 == 0,
                instances_number=1000 * (index + 1),
                features_number=index + 1,
                num_citations=index,
                year=2000 + (index % 26),
            )
        )
    db_session.commit()
    headers = auth(client)

    started = time.perf_counter()
    response = client.post("/api/v1/datasets/score", json={"weights": []}, headers=headers)
    elapsed = time.perf_counter() - started
    assert response.status_code == 200
    assert len(response.json()["results"]) == 100
    assert elapsed < 1.0, f"scoring trop lent : {elapsed:.2f}s"
