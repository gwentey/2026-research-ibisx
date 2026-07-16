"""Intégration M2 : upload, RBAC, filtres backend, aperçu réel, similaires, complétude."""

import io
import json
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from ibis.modules.auth.models import User, UserRole

CSV_STUDENTS = (
    "student_email,age,grade,school,note\n"
    "a@ex.org,15,B,GP,12.5\n"
    "b@ex.org,16,A,GP,15.0\n"
    "c@ex.org,,B,MS,\n"
    "d@ex.org,17,C,MS,9.0\n"
)


def promote(client: TestClient, db: Session, email: str, role: UserRole) -> dict[str, str]:
    """Inscrit, promeut en base, re-login (le rôle vit dans les claims du JWT)."""
    client.post("/api/v1/auth/register", json={"email": email, "password": "s3cret-pass"})
    user = db.query(User).filter(User.email == email).one()
    user.role = role
    db.commit()
    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "s3cret-pass"}
    ).json()
    return {"Authorization": f"Bearer {login['access_token']}"}


def create_dataset(
    client: TestClient,
    headers: dict[str, str],
    *,
    name: str = "Étude élèves",
    csv: str = CSV_STUDENTS,
    metadata_extra: dict | None = None,
) -> dict:
    metadata = {
        "display_name": name,
        "domain": ["education"],
        "task": ["classification"],
        "year": 2024,
        **(metadata_extra or {}),
    }
    response = client.post(
        "/api/v1/datasets",
        data={"metadata": json.dumps(metadata)},
        files=[("files", ("students.csv", io.BytesIO(csv.encode()), "text/csv"))],
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture()
def contributor(client: TestClient, db_session: Session) -> dict[str, str]:
    return promote(client, db_session, "contrib@example.org", UserRole.contributor)


@pytest.fixture()
def plain_user(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register", json={"email": "user@example.org", "password": "s3cret-pass"}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_upload_full_flow(client: TestClient, contributor: dict[str, str]) -> None:
    # ① analyse SANS persistance
    analysis = client.post(
        "/api/v1/datasets/preview",
        files=[("files", ("students.csv", io.BytesIO(CSV_STUDENTS.encode()), "text/csv"))],
        headers=contributor,
    )
    assert analysis.status_code == 200
    body = analysis.json()
    assert body["files"][0]["row_count"] == 4
    assert "education" in body["suggested_domains"]
    assert len(body["files"][0]["preview_rows"]) == 4

    # ② création réelle
    detail = create_dataset(client, contributor)
    assert detail["instances_number"] == 4
    assert detail["features_number"] == 5
    assert detail["has_missing_values"] is True
    assert detail["global_missing_percentage"] > 0
    assert detail["ethical_criteria"]["informed_consent"] is None  # tristate par défaut

    columns = {c["name"]: c for c in detail["files"][0]["columns"]}
    assert columns["student_email"]["is_pii"] is True  # PII détectée ET persistée
    assert columns["age"]["dtype_interpreted"] == "numerical"
    assert columns["age"]["stats"]["null_count"] == 1

    # ③ aperçu RÉEL depuis le Parquet
    preview = client.get(f"/api/v1/datasets/{detail['id']}/preview", headers=contributor)
    assert preview.status_code == 200
    assert preview.json()["total_rows"] == 4
    assert preview.json()["random_state"] == 42
    assert len(preview.json()["rows"]) == 4

    # ④ téléchargement authentifié du Parquet
    file_id = detail["files"][0]["id"]
    download = client.get(
        f"/api/v1/datasets/{detail['id']}/files/{file_id}/download", headers=contributor
    )
    assert download.status_code == 200
    assert download.content[:4] == b"PAR1"  # magic bytes Parquet

    # ⑤ complétude
    completion = client.get(f"/api/v1/datasets/{detail['id']}/completion", headers=contributor)
    assert completion.status_code == 200
    assert 0 < completion.json()["overall_percentage"] < 100
    assert "informed_consent" in completion.json()["needs_human_review"]


def test_rbac_upload_matrix(
    client: TestClient, plain_user: dict[str, str], contributor: dict[str, str]
) -> None:
    """CDC §3.2 : upload = contributor+ ; lecture = tous les rôles authentifiés."""
    files = [("files", ("s.csv", io.BytesIO(CSV_STUDENTS.encode()), "text/csv"))]
    denied = client.post(
        "/api/v1/datasets",
        data={"metadata": json.dumps({"display_name": "X"})},
        files=files,
        headers=plain_user,
    )
    assert denied.status_code == 403
    preview_denied = client.post("/api/v1/datasets/preview", files=files, headers=plain_user)
    assert preview_denied.status_code == 403

    detail = create_dataset(client, contributor)
    assert client.get("/api/v1/datasets", headers=plain_user).status_code == 200
    assert client.get(f"/api/v1/datasets/{detail['id']}", headers=plain_user).status_code == 200
    # Sans authentification : rien
    assert client.get("/api/v1/datasets").status_code == 401


def test_ownership_update_delete(
    client: TestClient, db_session: Session, contributor: dict[str, str]
) -> None:
    other = promote(client, db_session, "other@example.org", UserRole.contributor)
    admin = promote(client, db_session, "admin@example.org", UserRole.admin)
    detail = create_dataset(client, contributor)
    dataset_id = detail["id"]

    assert (
        client.put(
            f"/api/v1/datasets/{dataset_id}", json={"objective": "hack"}, headers=other
        ).status_code
        == 403
    )
    assert (
        client.put(
            f"/api/v1/datasets/{dataset_id}",
            json={"objective": "Étude des notes."},
            headers=contributor,
        ).status_code
        == 200
    )
    updated = client.put(
        f"/api/v1/datasets/{dataset_id}", json={"transparency": True}, headers=admin
    )
    assert updated.status_code == 200
    assert updated.json()["ethical_criteria"]["transparency"] is True
    assert updated.json()["ethical_score"] == pytest.approx(0.1)

    assert client.delete(f"/api/v1/datasets/{dataset_id}", headers=other).status_code == 403
    assert client.delete(f"/api/v1/datasets/{dataset_id}", headers=contributor).status_code == 204
    assert client.get(f"/api/v1/datasets/{dataset_id}", headers=contributor).status_code == 404


def test_filters_families(client: TestClient, contributor: dict[str, str]) -> None:
    create_dataset(
        client,
        contributor,
        name="Edu classification",
        metadata_extra={
            "domain": ["education", "social"],
            "task": ["classification"],
            "year": 2020,
            "transparency": True,
            "informed_consent": True,
            "anonymization_applied": True,
            "split": True,
        },
    )
    create_dataset(
        client,
        contributor,
        name="Santé régression",
        csv="glucose,bmi,outcome\n1.0,2.0,0\n2.0,3.0,1\n3.0,4.0,0\n",
        metadata_extra={"domain": ["healthcare"], "task": ["regression"], "year": 2024},
    )

    def search(**params: object) -> list[str]:
        response = client.get("/api/v1/datasets", params=params, headers=contributor)
        assert response.status_code == 200, response.text
        return [item["display_name"] for item in response.json()["items"]]

    # Containment : TOUS les domaines cochés
    assert search(domains=["education", "social"]) == ["Edu classification"]
    assert search(domains=["education", "healthcare"]) == []
    assert search(tasks=["regression"]) == ["Santé régression"]
    # Plages
    assert search(year_min=2021) == ["Santé régression"]
    assert search(instances_min=4) == ["Edu classification"]
    # Recherche plein texte
    assert search(q="santé") == ["Santé régression"]
    # Toggles booléens (ne filtrent que si activés)
    assert search(split=True) == ["Edu classification"]
    assert search(anonymized=True) == ["Edu classification"]
    # Tristate manquants : avec / sans / peu importe
    assert search(has_missing_values=True) == ["Edu classification"]
    assert search(has_missing_values=False) == ["Santé régression"]
    assert len(search()) == 2
    # Critère éthique individuel + score éthique min (3/10 = 30 %)
    assert search(informed_consent=True) == ["Edu classification"]
    assert search(ethical_score_min=30) == ["Edu classification"]
    assert search(ethical_score_min=40) == []
    # Tri
    assert search(sort_by="year", sort_order="desc")[0] == "Santé régression"
    # Pagination
    page = client.get(
        "/api/v1/datasets", params={"page_size": 12, "page": 1}, headers=contributor
    ).json()
    assert page["total"] == 2
    assert page["total_pages"] == 1


def test_preview_missing_file_is_explicit_error(
    client: TestClient, contributor: dict[str, str]
) -> None:
    """P1 : fichier stockage absent → erreur explicite, JAMAIS d'aperçu simulé."""
    import pathlib

    from ibis.storage import get_storage

    detail = create_dataset(client, contributor)
    # Sabotage : suppression du fichier physique dans le stockage
    storage = get_storage()
    root = pathlib.Path(storage.root)  # type: ignore[attr-defined]
    for parquet in (root / "datasets" / detail["id"]).glob("*.parquet"):
        parquet.unlink()

    response = client.get(f"/api/v1/datasets/{detail['id']}/preview", headers=contributor)
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "DATASET_FILE_UNAVAILABLE"


def test_similar_and_facets(client: TestClient, contributor: dict[str, str]) -> None:
    edu_classif = {"domain": ["education"], "task": ["classification"]}
    a = create_dataset(client, contributor, name="A", metadata_extra=edu_classif)
    create_dataset(client, contributor, name="B", metadata_extra=edu_classif)
    create_dataset(
        client,
        contributor,
        name="C",
        metadata_extra={"domain": ["education"], "task": ["regression"]},
    )
    create_dataset(
        client,
        contributor,
        name="D",
        metadata_extra={"domain": ["finance"], "task": ["classification"]},
    )

    similar = client.get(f"/api/v1/datasets/{a['id']}/similar", headers=contributor).json()
    reasons = {s["dataset"]["display_name"]: s["reason"] for s in similar}
    assert reasons["B"] == "domain_and_task"
    assert reasons["C"] == "domain"
    assert reasons["D"] == "task"

    facets = client.get("/api/v1/datasets/facets", headers=contributor).json()
    domains = {f["value"]: f["count"] for f in facets["domains"]}
    assert domains["education"] == 3
    assert domains["finance"] == 1

    stats = client.get("/api/v1/datasets/stats", headers=contributor).json()
    assert stats["total_datasets"] == 4


def test_duplicate_slug_conflict(client: TestClient, contributor: dict[str, str]) -> None:
    create_dataset(client, contributor, name="Unique")
    response = client.post(
        "/api/v1/datasets",
        data={"metadata": json.dumps({"display_name": "Unique"})},
        files=[("files", ("s.csv", io.BytesIO(CSV_STUDENTS.encode()), "text/csv"))],
        headers=contributor,
    )
    assert response.status_code == 409


def test_ai_guide_job_created(
    client: TestClient, contributor: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    from ibis.workers.tasks import guide as guide_module

    calls: list[tuple] = []
    monkeypatch.setattr(
        guide_module.generate_dataset_guide,
        "apply_async",
        lambda args, queue: calls.append((args, queue)),
    )
    detail = create_dataset(client, contributor)
    response = client.post(
        f"/api/v1/datasets/{detail['id']}/ai-guide?language=fr", headers=contributor
    )
    assert response.status_code == 202
    job_id = response.json()["job_id"]
    assert calls and calls[0][1] == "llm"
    job = client.get(f"/api/v1/jobs/{job_id}", headers=contributor)
    assert job.status_code == 200
    assert job.json()["kind"] == "guide"


def test_guide_fallback_is_honest(
    client: TestClient, contributor: dict[str, str], db_session: Session
) -> None:
    """Sans clé LLM : fallback déterministe marqué is_fallback (P2), construit sur le réel."""
    from ibis.modules.datasets import service as ds_service
    from ibis.modules.llm import guides

    detail = create_dataset(client, contributor)
    dataset = ds_service.get_dataset(db_session, uuid.UUID(detail["id"]))
    text = guides.fallback_guide(dataset, "fr")
    assert "## À quoi sert ce dataset" in text
    assert "student_email" in text  # colonnes PII réellement listées en précaution
    payload = guides.guide_payload(
        text=text, model_used="fallback", is_fallback=True, language="fr", tokens_used=0
    )
    assert payload["is_fallback"] is True
