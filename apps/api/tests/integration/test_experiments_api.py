"""Intégration M5 : cycle complet d'expérience exécuté EN VRAI (tâche appelée en direct),
quotas, crédits, brouillon, annulation, erreurs typées, comparaison, déterminisme."""

import io
import json
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from ibis.modules.auth.models import User, UserRole

CSV = (
    "sepal_length,sepal_width,petal_length,petal_width,species\n"
    + "\n".join(
        f"{5 + i * 0.02},{3 + (i % 5) * 0.1},{1 + (i % 30) * 0.15},{0.1 + (i % 20) * 0.1},"
        + ("alpha" if i % 3 == 0 else "beta" if i % 3 == 1 else "gamma")
        for i in range(90)
    )
    + "\n"
)


@pytest.fixture()
def env(worker_client: TestClient, real_db: Session) -> dict:
    """Contributor + dataset + projet prêts à l'emploi."""
    register = worker_client.post(
        "/api/v1/auth/register", json={"email": "ml@example.org", "password": "s3cret-pass"}
    ).json()
    user = real_db.query(User).filter(User.email == "ml@example.org").one()
    user.role = UserRole.contributor
    real_db.commit()
    login = worker_client.post(
        "/api/v1/auth/login", json={"email": "ml@example.org", "password": "s3cret-pass"}
    ).json()
    headers = {"Authorization": f"Bearer {login['access_token']}"}

    dataset = worker_client.post(
        "/api/v1/datasets",
        data={"metadata": json.dumps({"display_name": "Fleurs test", "task": ["classification"]})},
        files=[("files", ("fleurs.csv", io.BytesIO(CSV.encode()), "text/csv"))],
        headers=headers,
    ).json()
    project = worker_client.post(
        "/api/v1/projects",
        json={"name": "Projet ML", "criteria": {}, "weights": {}},
        headers=headers,
    ).json()
    return {
        "headers": headers,
        "dataset": dataset,
        "project": project,
        "user_id": register["user"]["id"],
    }


def start_payload(env: dict, **overrides: object) -> dict:
    payload = {
        "project_id": env["project"]["id"],
        "dataset_id": env["dataset"]["id"],
        "algorithm": "decision_tree",
        "hyperparameters": {"max_depth": 4},
        "preprocessing": {"target_column": "species", "task_type": "classification"},
    }
    payload.update(overrides)
    return payload


def run_worker_task(experiment: dict) -> None:
    """Exécute la tâche d'entraînement EN DIRECT (même code que le worker)."""
    from ibis.workers.tasks import train

    train.train_experiment.run(experiment["id"], str(experiment["job_id"]))


def test_full_experiment_cycle_with_honest_preprocessing(
    worker_client: TestClient, env: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    from ibis.workers.tasks.train import train_experiment

    monkeypatch.setattr(
        train_experiment, "apply_async", lambda args, queue: type("R", (), {"id": "test-task"})()
    )
    created = worker_client.post(
        "/api/v1/experiments", json=start_payload(env), headers=env["headers"]
    )
    assert created.status_code == 201, created.text
    experiment = created.json()
    assert experiment["status"] == "pending"

    # Crédit débité (100 → 99)
    me = worker_client.get("/api/v1/users/me", headers=env["headers"]).json()
    assert me["credits"] == 99

    run_worker_task(experiment)

    detail = worker_client.get(
        f"/api/v1/experiments/{experiment['id']}", headers=env["headers"]
    ).json()
    assert detail["status"] == "completed"
    assert detail["progress"] == 100
    assert detail["duration_seconds"] is not None

    results = worker_client.get(
        f"/api/v1/experiments/{experiment['id']}/results", headers=env["headers"]
    ).json()
    assert results["metrics"]["primary_metric"] == "f1_macro"
    assert 0 <= results["metrics"]["f1_macro"] <= 1
    # Contrat d'honnêteté T1 : la config est appliquée et le détail est exposé
    assert results["applied_preprocessing"]["applied"] is True
    assert any("pipeline_fit_on_train_only" in s for s in results["applied_preprocessing"]["steps"])
    assert results["viz_data"]["confusion_matrix"]["classes"] == ["alpha", "beta", "gamma"]
    assert results["viz_data"]["feature_importance"]
    assert results["viz_data"]["tree_structure"]["root"]["type"] == "split"
    assert results["composite"]["label"] in ("excellent", "good", "fair", "needs_improvement")

    # Logs de console lisibles
    logs = worker_client.get(
        f"/api/v1/experiments/{experiment['id']}/logs", headers=env["headers"]
    ).json()
    assert any("Chargement du dataset" in line["message"] for line in logs)
    assert any("Préprocessing appliqué" in line["message"] for line in logs)

    # Téléchargement du modèle .joblib
    model = worker_client.get(
        f"/api/v1/experiments/{experiment['id']}/download-model", headers=env["headers"]
    )
    assert model.status_code == 200
    assert len(model.content) > 1000

    # Benchmarking : l'expérience apparaît dans l'onglet du projet
    summary = worker_client.get(
        f"/api/v1/projects/{env['project']['id']}/experiments", headers=env["headers"]
    ).json()
    assert summary[0]["primary_metric_name"] == "f1_macro"
    assert summary[0]["dataset_name"] == "Fleurs test"


def test_determinism_two_runs_identical(
    worker_client: TestClient, env: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    """P4 : deux exécutions de la même config → métriques et importance IDENTIQUES."""
    from ibis.workers.tasks.train import train_experiment

    monkeypatch.setattr(
        train_experiment, "apply_async", lambda args, queue: type("R", (), {"id": "t"})()
    )
    results = []
    for _ in range(2):
        experiment = worker_client.post(
            "/api/v1/experiments", json=start_payload(env), headers=env["headers"]
        ).json()
        run_worker_task(experiment)
        body = worker_client.get(
            f"/api/v1/experiments/{experiment['id']}/results", headers=env["headers"]
        ).json()
        results.append(body)
        # supprime pour libérer le quota simultané
        worker_client.delete(f"/api/v1/experiments/{experiment['id']}", headers=env["headers"])
    assert results[0]["metrics"] == results[1]["metrics"]
    assert results[0]["feature_importance"] == results[1]["feature_importance"]


def test_quotas_and_credits(
    worker_client: TestClient, env: dict, real_db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    from ibis.workers.tasks.train import train_experiment

    monkeypatch.setattr(
        train_experiment, "apply_async", lambda args, queue: type("R", (), {"id": "t"})()
    )
    # 3 lancements simultanés OK (ils restent pending), le 4e → 429
    for _ in range(3):
        response = worker_client.post(
            "/api/v1/experiments", json=start_payload(env), headers=env["headers"]
        )
        assert response.status_code == 201
    blocked = worker_client.post(
        "/api/v1/experiments", json=start_payload(env), headers=env["headers"]
    )
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "MAX_CONCURRENT_TRAININGS"

    # Crédits : 3 débités
    me = worker_client.get("/api/v1/users/me", headers=env["headers"]).json()
    assert me["credits"] == 97

    # Libère le quota simultané (remboursement des pending), puis vide les crédits → 402
    experiments = worker_client.get(
        f"/api/v1/projects/{env['project']['id']}/experiments", headers=env["headers"]
    ).json()
    for experiment in experiments:
        worker_client.post(f"/api/v1/experiments/{experiment['id']}/cancel", headers=env["headers"])
    user = real_db.query(User).filter(User.email == "ml@example.org").one()
    user.credits = 0
    real_db.commit()
    broke = worker_client.post(
        "/api/v1/experiments", json=start_payload(env), headers=env["headers"]
    )
    assert broke.status_code == 402
    assert broke.json()["detail"]["code"] == "INSUFFICIENT_CREDITS"


def test_cancel_pending_refunds_credit(
    worker_client: TestClient, env: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    from ibis.workers.tasks.train import train_experiment

    monkeypatch.setattr(
        train_experiment, "apply_async", lambda args, queue: type("R", (), {"id": "t"})()
    )
    experiment = worker_client.post(
        "/api/v1/experiments", json=start_payload(env), headers=env["headers"]
    ).json()
    assert worker_client.get("/api/v1/users/me", headers=env["headers"]).json()["credits"] == 99

    cancelled = worker_client.post(
        f"/api/v1/experiments/{experiment['id']}/cancel", headers=env["headers"]
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    # Remboursé : le calcul n'avait pas commencé
    assert worker_client.get("/api/v1/users/me", headers=env["headers"]).json()["credits"] == 100


def test_dataset_unavailable_is_explicit_failure(
    worker_client: TestClient, env: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    """[NE PAS REPRODUIRE] T6 : jamais d'entraînement de secours sur données synthétiques."""
    import pathlib

    from ibis.storage import get_storage
    from ibis.workers.tasks.train import train_experiment

    monkeypatch.setattr(
        train_experiment, "apply_async", lambda args, queue: type("R", (), {"id": "t"})()
    )
    experiment = worker_client.post(
        "/api/v1/experiments", json=start_payload(env), headers=env["headers"]
    ).json()
    root = pathlib.Path(get_storage().root)  # type: ignore[attr-defined]
    for parquet in (root / "datasets" / env["dataset"]["id"]).glob("*.parquet"):
        parquet.unlink()

    run_worker_task(experiment)
    detail = worker_client.get(
        f"/api/v1/experiments/{experiment['id']}", headers=env["headers"]
    ).json()
    assert detail["status"] == "failed"
    assert detail["error_code"] == "DATASET_FILE_UNAVAILABLE"


def test_invalid_cleaning_config_fails_explicitly(
    worker_client: TestClient, env: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    from ibis.workers.tasks.train import train_experiment

    monkeypatch.setattr(
        train_experiment, "apply_async", lambda args, queue: type("R", (), {"id": "t"})()
    )
    payload = start_payload(
        env,
        preprocessing={
            "target_column": "species",
            "task_type": "classification",
            "column_strategies": {"fantome": {"strategy": "mean"}},
        },
    )
    experiment = worker_client.post(
        "/api/v1/experiments", json=payload, headers=env["headers"]
    ).json()
    run_worker_task(experiment)
    detail = worker_client.get(
        f"/api/v1/experiments/{experiment['id']}", headers=env["headers"]
    ).json()
    assert detail["status"] == "failed"
    assert detail["error_code"] == "CLEANING_CONFIG_INVALID"


def test_unknown_algorithm_rejected_at_start(worker_client: TestClient, env: dict) -> None:
    response = worker_client.post(
        "/api/v1/experiments",
        json=start_payload(env, algorithm="xgboost"),
        headers=env["headers"],
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "UNKNOWN_ALGORITHM"


def test_draft_upsert_and_resume(worker_client: TestClient, env: dict) -> None:
    """Brouillon persisté côté serveur → reprise du wizard (P5)."""
    state = {"step": 3, "target": "species"}
    saved = worker_client.put(
        "/api/v1/experiments/draft",
        json={
            "project_id": env["project"]["id"],
            "dataset_id": env["dataset"]["id"],
            "state": state,
        },
        headers=env["headers"],
    )
    assert saved.status_code == 200
    again = worker_client.put(
        "/api/v1/experiments/draft",
        json={
            "project_id": env["project"]["id"],
            "dataset_id": env["dataset"]["id"],
            "state": {"step": 5},
        },
        headers=env["headers"],
    ).json()
    assert again["id"] == saved.json()["id"]  # upsert, pas de doublon

    resumed = worker_client.get(
        "/api/v1/experiments/draft",
        params={"project_id": env["project"]["id"], "dataset_id": env["dataset"]["id"]},
        headers=env["headers"],
    ).json()
    assert resumed["draft_state"] == {"step": 5}


def test_quality_analysis_cached(worker_client: TestClient, env: dict) -> None:
    first = worker_client.get(
        f"/api/v1/datasets/{env['dataset']['id']}/quality-analysis", headers=env["headers"]
    )
    assert first.status_code == 200
    body = first.json()
    assert body["quality_score"] == 100  # CSV propre
    assert body["analysis"]["columns_to_clean"] == []
    second = worker_client.get(
        f"/api/v1/datasets/{env['dataset']['id']}/quality-analysis", headers=env["headers"]
    ).json()
    assert second["computed_at"] == body["computed_at"]  # servi depuis le cache 7 j


def test_compare_experiments(
    worker_client: TestClient, env: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    from ibis.workers.tasks.train import train_experiment

    monkeypatch.setattr(
        train_experiment, "apply_async", lambda args, queue: type("R", (), {"id": "t"})()
    )
    ids = []
    for algorithm in ("decision_tree", "random_forest"):
        experiment = worker_client.post(
            "/api/v1/experiments",
            json=start_payload(env, algorithm=algorithm, hyperparameters={}),
            headers=env["headers"],
        ).json()
        run_worker_task(experiment)
        ids.append(experiment["id"])

    compared = worker_client.post(
        "/api/v1/experiments/compare", json={"experiment_ids": ids}, headers=env["headers"]
    )
    assert compared.status_code == 200
    body = compared.json()
    assert len(body["rows"]) == 2
    assert "f1_macro" in body["metric_keys"]
    assert {row["algorithm"] for row in body["rows"]} == {"decision_tree", "random_forest"}


def test_isolation_between_users(worker_client: TestClient, env: dict) -> None:
    other = worker_client.post(
        "/api/v1/auth/register", json={"email": "other@example.org", "password": "s3cret-pass"}
    ).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}
    assert (
        worker_client.get(f"/api/v1/experiments/{uuid.uuid4()}", headers=other_headers).status_code
        == 404
    )
    assert (
        worker_client.get(
            f"/api/v1/projects/{env['project']['id']}/experiments", headers=other_headers
        ).status_code
        == 404
    )
