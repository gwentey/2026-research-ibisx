"""Intégration M6 : cycle complet d'explication (worker en direct), déterminisme SHAP,
sélection d'instance serveur, chat (quota 5), fallback honnête sans clé LLM."""

import io
import json

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
def trained(worker_client: TestClient, real_db: Session, monkeypatch: pytest.MonkeyPatch) -> dict:
    """Contributor + dataset + projet + expérience ENTRAÎNÉE (vrai code worker)."""
    from ibis.workers.tasks import train
    from ibis.workers.tasks.explain import generate_explanation

    monkeypatch.setattr(
        train.train_experiment, "apply_async", lambda args, queue: type("R", (), {"id": "t"})()
    )
    monkeypatch.setattr(
        generate_explanation, "apply_async", lambda args, queue: type("R", (), {"id": "x"})()
    )

    register = worker_client.post(
        "/api/v1/auth/register", json={"email": "xai@example.org", "password": "s3cret-pass"}
    ).json()
    user = real_db.query(User).filter(User.email == "xai@example.org").one()
    user.role = UserRole.contributor
    real_db.commit()
    login = worker_client.post(
        "/api/v1/auth/login", json={"email": "xai@example.org", "password": "s3cret-pass"}
    ).json()
    headers = {"Authorization": f"Bearer {login['access_token']}"}

    dataset = worker_client.post(
        "/api/v1/datasets",
        data={"metadata": json.dumps({"display_name": "Fleurs XAI"})},
        files=[("files", ("fleurs.csv", io.BytesIO(CSV.encode()), "text/csv"))],
        headers=headers,
    ).json()
    project = worker_client.post(
        "/api/v1/projects",
        json={"name": "Projet XAI", "criteria": {}, "weights": {}},
        headers=headers,
    ).json()
    experiment = worker_client.post(
        "/api/v1/experiments",
        json={
            "project_id": project["id"],
            "dataset_id": dataset["id"],
            "algorithm": "random_forest",
            "hyperparameters": {"n_estimators": 20},
            "preprocessing": {"target_column": "species", "task_type": "classification"},
        },
        headers=headers,
    ).json()
    train.train_experiment.run(experiment["id"], str(experiment["job_id"]))
    return {"headers": headers, "experiment": experiment, "register": register}


def run_explanation(worker_client: TestClient, trained: dict, payload: dict) -> dict:
    from ibis.workers.tasks.explain import generate_explanation

    response = worker_client.post(
        f"/api/v1/experiments/{trained['experiment']['id']}/explanations",
        json=payload,
        headers=trained["headers"],
    )
    assert response.status_code == 202, response.text
    explanation = response.json()
    generate_explanation.run(explanation["id"], str(explanation["job_id"]))
    results = worker_client.get(
        f"/api/v1/explanations/{explanation['id']}/results", headers=trained["headers"]
    )
    assert results.status_code == 200, results.text
    return results.json()


def test_global_shap_explanation_full_cycle(worker_client: TestClient, trained: dict) -> None:
    results = run_explanation(worker_client, trained, {"type": "global", "method": "auto"})

    assert results["method_used"] == "shap_tree"
    assert "TreeExplainer" in results["method_justification"]
    # Valeurs + métadonnées de reproductibilité (P4)
    importance = results["values"]["importance"]
    assert len(importance) >= 4
    metadata = results["values"]["metadata"]
    assert metadata["random_state"] == 42
    assert metadata["multiclass_policy"] == "mean_abs"
    assert metadata["stability_seeds"] == [42, 43, 44, 45, 46]
    # KPI CALCULÉS (jamais de défaut)
    kpis = results["quality_kpis"]
    assert kpis["computation_seconds"] > 0
    assert kpis["stability"]["spearman_mean"] >= -1
    assert kpis["parsimony"]["k"] >= 1
    # Viz : importance + beeswarm [SHOULD]
    assert results["viz_data"]["global_importance"]
    assert len(results["viz_data"]["beeswarm"]) > 0
    # Texte : fallback honnête (pas de clé OpenRouter en test) — P2
    assert results["is_fallback"] is True
    assert results["model_used"] == "fallback"
    assert results["text_explanation"]
    assert results["processing_seconds"] > 0


def test_local_shap_explanation_with_server_instance(
    worker_client: TestClient, trained: dict
) -> None:
    # Sélection d'instance CÔTÉ SERVEUR : tableau paginé trié par erreur (CDC §9.2)
    instances = worker_client.get(
        f"/api/v1/experiments/{trained['experiment']['id']}/test-instances",
        params={"page": 1, "page_size": 5},
        headers=trained["headers"],
    )
    assert instances.status_code == 200
    body = instances.json()
    assert body["total"] > 0
    first = body["items"][0]
    assert {"index", "actual", "predicted", "error"} <= set(first)
    # tri par erreur décroissante
    errors = [item["error"] for item in body["items"]]
    assert errors == sorted(errors, reverse=True)

    results = run_explanation(
        worker_client,
        trained,
        {"type": "local", "method": "auto", "instance_index": int(first["index"])},
    )
    assert results["method_used"] == "shap_tree"
    contributions = results["values"]["contributions"]
    assert len(contributions) >= 4
    assert results["values"]["predicted_label"] in ("alpha", "beta", "gamma")
    # Complétude SHAP : axiome d'efficience vérifié sur la vraie instance
    completeness = results["quality_kpis"]["shap_completeness"]
    assert completeness["satisfied"] is True
    assert results["viz_data"]["waterfall"]


def test_lime_local_explanation(worker_client: TestClient, trained: dict) -> None:
    results = run_explanation(
        worker_client, trained, {"type": "local", "method": "lime", "instance_index": 0}
    )
    assert results["method_used"] == "lime"
    metadata = results["values"]["metadata"]
    assert metadata["num_samples"] == 1000  # réellement transmis ([NE PAS REPRODUIRE] v1)
    assert metadata["random_state"] == 42
    # Fidélité LIME stockée ET exposée ([NE PAS REPRODUIRE] : jetée en v1)
    assert "lime_fidelity" in results["quality_kpis"]
    assert 0 <= results["quality_kpis"]["lime_fidelity"]["r2"] <= 1


def test_shap_determinism_double_run(worker_client: TestClient, trained: dict) -> None:
    """P4 : deux explications globales identiques → valeurs SHAP STRICTEMENT identiques."""
    first = run_explanation(worker_client, trained, {"type": "global", "method": "shap"})
    second = run_explanation(worker_client, trained, {"type": "global", "method": "shap"})
    assert first["values"]["importance"] == second["values"]["importance"]
    assert first["values"]["ranking"] == second["values"]["ranking"]


def test_explanation_debits_credit_and_lists(worker_client: TestClient, trained: dict) -> None:
    before = worker_client.get("/api/v1/users/me", headers=trained["headers"]).json()["credits"]
    run_explanation(worker_client, trained, {"type": "global"})
    after = worker_client.get("/api/v1/users/me", headers=trained["headers"]).json()["credits"]
    assert after == before - 1  # 1 explication = 1 crédit (CDC §3.3)

    history = worker_client.get(
        f"/api/v1/experiments/{trained['experiment']['id']}/explanations",
        headers=trained["headers"],
    ).json()
    assert len(history) >= 1


def test_chat_session_quota_and_fallback(worker_client: TestClient, trained: dict) -> None:
    from ibis.workers.tasks.explain import answer_chat_question

    results = run_explanation(worker_client, trained, {"type": "global"})
    session = worker_client.post(
        f"/api/v1/explanations/{results['id']}/chat",
        json={"language": "fr"},
        headers=trained["headers"],
    )
    assert session.status_code == 201
    session_id = session.json()["id"]

    # Suggestions contextuelles déterministes
    suggestions = worker_client.get(
        f"/api/v1/experiments/{trained['experiment']['id']}/suggested-questions",
        headers=trained["headers"],
    ).json()
    assert len(suggestions) == 4

    # 5 questions OK (worker exécuté en direct), la 6e → 429 (CDC §3.3)
    for index in range(5):
        asked = worker_client.post(
            f"/api/v1/chat/{session_id}/messages",
            json={"question": f"Question {index} ?"},
            headers=trained["headers"],
        )
        assert asked.status_code == 202, asked.text
        answer_chat_question.run(session_id, f"Question {index} ?")
    blocked = worker_client.post(
        f"/api/v1/chat/{session_id}/messages",
        json={"question": "Une de trop ?"},
        headers=trained["headers"],
    )
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "MAX_CHAT_QUESTIONS"

    messages = worker_client.get(
        f"/api/v1/chat/{session_id}/messages", headers=trained["headers"]
    ).json()
    roles = [m["role"] for m in messages]
    assert roles.count("user") == 5
    assert roles.count("assistant") == 5
    # Sans clé LLM : réponses en fallback marqué (P2) — plateforme 100 % fonctionnelle
    assert all(m["is_fallback"] for m in messages if m["role"] == "assistant")


def test_explanation_audience_override(worker_client: TestClient, trained: dict) -> None:
    """P3 (adaptatif §5.1) : le niveau effectif surcharge le profil pour CETTE explication.

    Le profil par défaut est « novice » ; sans surcharge, l'explication reste au profil ;
    avec `audience=expert`, elle est générée (et stockée) en vue expert, sans toucher au profil.
    """
    default = run_explanation(worker_client, trained, {"type": "global"})
    assert default["audience_level"] == "novice"  # = profil

    overridden = run_explanation(
        worker_client, trained, {"type": "global", "audience": "expert"}
    )
    assert overridden["audience_level"] == "expert"  # surcharge éphémère

    # Le profil de l'utilisateur n'est PAS modifié par la surcharge.
    me = worker_client.get("/api/v1/users/me", headers=trained["headers"]).json()
    assert me["xai_audience"] == "novice"


def test_explanation_audience_rejects_unknown_level(
    worker_client: TestClient, trained: dict
) -> None:
    """Une valeur d'audience hors énumération est refusée (422), jamais silencieusement ignorée."""
    denied = worker_client.post(
        f"/api/v1/experiments/{trained['experiment']['id']}/explanations",
        json={"type": "global", "audience": "wizard"},
        headers=trained["headers"],
    )
    assert denied.status_code == 422


def test_chat_and_explanation_fallback_follow_audience(
    worker_client: TestClient, trained: dict
) -> None:
    """P4 : sans clé LLM, l'explication ET le chat retombent sur un repli déterministe — qui
    parle néanmoins au NIVEAU de l'explication (adaptatif §5.2/§5.3 : novice ≠ expert)."""
    from ibis.workers.tasks.explain import answer_chat_question

    novice = run_explanation(worker_client, trained, {"type": "global", "audience": "novice"})
    expert = run_explanation(worker_client, trained, {"type": "global", "audience": "expert"})
    assert novice["is_fallback"] and expert["is_fallback"]
    # §5.3 : le repli de l'explication varie selon le niveau (même modèle, même données).
    assert novice["text_explanation"] != expert["text_explanation"]

    def first_answer(explanation_id: str) -> str:
        session = worker_client.post(
            f"/api/v1/explanations/{explanation_id}/chat",
            json={"language": "fr"},
            headers=trained["headers"],
        ).json()
        worker_client.post(
            f"/api/v1/chat/{session['id']}/messages",
            json={"question": "Pourquoi cette prédiction ?"},
            headers=trained["headers"],
        )
        answer_chat_question.run(session["id"], "Pourquoi cette prédiction ?")
        messages = worker_client.get(
            f"/api/v1/chat/{session['id']}/messages", headers=trained["headers"]
        ).json()
        assistant = [m for m in messages if m["role"] == "assistant"]
        assert assistant and assistant[0]["is_fallback"]
        return assistant[0]["content"]

    # §5.2 : le chat (repli déterministe) suit le niveau de l'explication qu'il commente.
    assert first_answer(novice["id"]) != first_answer(expert["id"])


def test_explanation_requires_completed_experiment(
    worker_client: TestClient, trained: dict, real_db: Session
) -> None:
    from ibis.modules.experiments.models import Experiment, ExperimentStatus

    experiment = real_db.get(Experiment, __import__("uuid").UUID(trained["experiment"]["id"]))
    experiment.status = ExperimentStatus.running
    real_db.commit()
    denied = worker_client.post(
        f"/api/v1/experiments/{trained['experiment']['id']}/explanations",
        json={"type": "global"},
        headers=trained["headers"],
    )
    assert denied.status_code == 409
    experiment.status = ExperimentStatus.completed
    real_db.commit()


def test_fairness_report_groups_by_column(worker_client: TestClient, trained: dict) -> None:
    """L'endpoint d'équité recharge le split déterministe et regroupe par colonne brute."""
    response = worker_client.get(
        f"/api/v1/experiments/{trained['experiment']['id']}/fairness",
        params={"sensitive_column": "sepal_width"},
        headers=trained["headers"],
    )
    assert response.status_code == 200
    data = response.json()
    assert data["applicable"] is True
    assert data["sensitive_column"] == "sepal_width"
    assert len(data["groups"]) >= 2
    # Les tailles de groupe se somment au nombre d'instances de test (alignement correct).
    total = sum(group["size"] for group in data["groups"])
    assert total == data["total"] and total > 0
    for group in data["groups"]:
        assert 0.0 <= group["accuracy"] <= 1.0


def test_fairness_unknown_column_errors(worker_client: TestClient, trained: dict) -> None:
    response = worker_client.get(
        f"/api/v1/experiments/{trained['experiment']['id']}/fairness",
        params={"sensitive_column": "colonne_inexistante"},
        headers=trained["headers"],
    )
    assert response.status_code == 422
