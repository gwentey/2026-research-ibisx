"""Intégration M8 : matrice RBAC admin, garde dernier admin, crédits, templates, supervision.

[NE PAS REPRODUIRE] S1/S2 : chaque endpoint admin est vérifié pour anonyme/user/contributor.
"""

import io
import json
import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from ibis.modules.auth.models import User, UserRole
from ibis.modules.jobs.models import Job, JobKind, JobStatus

PASSWORD = "s3cret-pass"


def register(client: TestClient, email: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD})
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def promote(client: TestClient, db: Session, email: str, role: UserRole) -> dict[str, str]:
    """Inscrit, promeut en base, re-login (le rôle vit dans les claims du JWT)."""
    client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD})
    user = db.query(User).filter(User.email == email).one()
    user.role = role
    db.commit()
    login = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD}).json()
    return {"Authorization": f"Bearer {login['access_token']}"}


def user_id_of(db: Session, email: str) -> str:
    return str(db.query(User).filter(User.email == email).one().id)


# ------------------------------------ Matrice RBAC -------------------------------------------


def test_admin_rbac_matrix(client: TestClient, db_session: Session) -> None:
    """TOUT /admin est interdit aux anonymes (401), users et contributors (403)."""
    fake_id = uuid.uuid4()
    calls = [
        ("GET", "/api/v1/admin/users", None),
        ("PATCH", f"/api/v1/admin/users/{fake_id}", {"role": "admin"}),
        ("DELETE", f"/api/v1/admin/users/{fake_id}", None),
        ("GET", "/api/v1/admin/ethical-templates", None),
        ("PUT", "/api/v1/admin/ethical-templates/sante", {"defaults": {}}),
        ("DELETE", "/api/v1/admin/ethical-templates/sante", None),
        ("POST", f"/api/v1/admin/datasets/{fake_id}/reanalyze", None),
        ("GET", "/api/v1/admin/jobs", None),
        ("GET", "/api/v1/admin/audit", None),
    ]

    for method, url, body in calls:
        assert client.request(method, url, json=body).status_code == 401, f"anonyme {url}"

    simple_user = register(client, "simple@example.org")
    contributor = promote(client, db_session, "contrib@example.org", UserRole.contributor)
    for headers in (simple_user, contributor):
        for method, url, body in calls:
            response = client.request(method, url, json=body, headers=headers)
            assert response.status_code == 403, f"{method} {url} → {response.status_code}"
            assert response.json()["detail"]["code"] == "FORBIDDEN"


def test_admin_revoked_in_db_is_rejected(client: TestClient, db_session: Session) -> None:
    """Jeton encore valide mais rôle retiré en base → 403 (revérification EN BASE)."""
    headers = promote(client, db_session, "exadmin@example.org", UserRole.admin)
    user = db_session.query(User).filter(User.email == "exadmin@example.org").one()
    user.role = UserRole.user
    db_session.commit()
    assert client.get("/api/v1/admin/users", headers=headers).status_code == 403


# ------------------------------------ Utilisateurs -------------------------------------------


def test_users_list_search_and_update(client: TestClient, db_session: Session) -> None:
    admin = promote(client, db_session, "root@example.org", UserRole.admin)
    register(client, "cible@example.org")

    listing = client.get("/api/v1/admin/users", headers=admin).json()
    assert listing["total"] == 2

    search = client.get("/api/v1/admin/users", params={"q": "cible"}, headers=admin).json()
    assert search["total"] == 1
    target_id = search["items"][0]["id"]

    # Changement de rôle
    updated = client.patch(
        f"/api/v1/admin/users/{target_id}", json={"role": "contributor"}, headers=admin
    )
    assert updated.status_code == 200
    assert updated.json()["role"] == "contributor"

    # Recharge de crédits : 100 (défaut) + 50 → visible par l'utilisateur lui-même
    recharged = client.patch(
        f"/api/v1/admin/users/{target_id}", json={"add_credits": 50}, headers=admin
    )
    assert recharged.json()["credits"] == 150
    login = client.post(
        "/api/v1/auth/login", json={"email": "cible@example.org", "password": PASSWORD}
    ).json()
    me = client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {login['access_token']}"}
    ).json()
    assert me["credits"] == 150

    # Désactivation → login refusé
    client.patch(f"/api/v1/admin/users/{target_id}", json={"is_active": False}, headers=admin)
    refused = client.post(
        "/api/v1/auth/login", json={"email": "cible@example.org", "password": PASSWORD}
    )
    assert refused.status_code in (401, 403)

    # Toutes les actions sont tracées
    actions = {e["action"] for e in client.get("/api/v1/admin/audit", headers=admin).json()}
    assert {"role_changed", "credits_granted", "active_changed"} <= actions


def test_last_admin_guard(client: TestClient, db_session: Session) -> None:
    """Le dernier admin actif ne peut être rétrogradé, désactivé ni supprimé (CDC §11)."""
    admin = promote(client, db_session, "root@example.org", UserRole.admin)
    my_id = user_id_of(db_session, "root@example.org")

    for payload in ({"role": "user"}, {"is_active": False}):
        response = client.patch(f"/api/v1/admin/users/{my_id}", json=payload, headers=admin)
        assert response.status_code == 409
        assert response.json()["detail"]["code"] == "LAST_ADMIN"
    assert client.delete(f"/api/v1/admin/users/{my_id}", headers=admin).status_code == 409

    # Avec un second admin actif, la rétrogradation devient possible
    promote(client, db_session, "root2@example.org", UserRole.admin)
    response = client.patch(f"/api/v1/admin/users/{my_id}", json={"role": "user"}, headers=admin)
    assert response.status_code == 200
    assert response.json()["role"] == "user"


def test_delete_user(client: TestClient, db_session: Session) -> None:
    admin = promote(client, db_session, "root@example.org", UserRole.admin)
    register(client, "ephemere@example.org")
    target_id = user_id_of(db_session, "ephemere@example.org")

    assert client.delete(f"/api/v1/admin/users/{target_id}", headers=admin).status_code == 204
    assert client.get("/api/v1/admin/users", headers=admin).json()["total"] == 1
    refused = client.post(
        "/api/v1/auth/login", json={"email": "ephemere@example.org", "password": PASSWORD}
    )
    assert refused.status_code == 401

    unknown = client.delete(f"/api/v1/admin/users/{uuid.uuid4()}", headers=admin)
    assert unknown.status_code == 404


# ------------------------------------ Templates éthiques -------------------------------------


CSV_MINIMAL = "age,grade,target\n15,B,1\n16,A,0\n17,C,1\n15,B,0\n"


def upload_dataset(client: TestClient, headers: dict[str, str], **metadata_extra: object) -> dict:
    metadata = {
        "display_name": "Élèves test admin",
        "domain": ["education"],
        "task": ["classification"],
        **metadata_extra,
    }
    response = client.post(
        "/api/v1/datasets",
        data={"metadata": json.dumps(metadata)},
        files=[("files", ("eleves.csv", io.BytesIO(CSV_MINIMAL.encode()), "text/csv"))],
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_ethical_templates_crud_and_application(client: TestClient, db_session: Session) -> None:
    admin = promote(client, db_session, "root@example.org", UserRole.admin)

    # Upsert : critère inconnu refusé (source unique ethics.py)
    bad = client.put(
        "/api/v1/admin/ethical-templates/education",
        json={"defaults": {"critere_invente": True}},
        headers=admin,
    )
    assert bad.status_code == 422

    created = client.put(
        "/api/v1/admin/ethical-templates/education",
        json={"defaults": {"informed_consent": True, "anonymization_applied": True}},
        headers=admin,
    )
    assert created.status_code == 200
    assert created.json()["domain"] == "education"

    templates = client.get("/api/v1/admin/ethical-templates", headers=admin).json()
    assert [t["domain"] for t in templates] == ["education"]

    # Application à l'import : les champs NON renseignés héritent du template,
    # les valeurs explicitement saisies ne sont JAMAIS écrasées.
    contributor = promote(client, db_session, "contrib@example.org", UserRole.contributor)
    dataset = upload_dataset(client, contributor, anonymization_applied=False)
    assert dataset["ethical_criteria"]["informed_consent"] is True  # hérité du template
    assert dataset["ethical_criteria"]["anonymization_applied"] is False  # valeur saisie conservée

    # Suppression
    assert (
        client.delete("/api/v1/admin/ethical-templates/education", headers=admin).status_code
        == 204
    )
    assert client.get("/api/v1/admin/ethical-templates", headers=admin).json() == []
    missing = client.delete("/api/v1/admin/ethical-templates/education", headers=admin)
    assert missing.status_code == 404


# ------------------------------------ Datasets & supervision ---------------------------------


def test_admin_reanalyze_dataset(client: TestClient, db_session: Session) -> None:
    admin = promote(client, db_session, "root@example.org", UserRole.admin)
    contributor = promote(client, db_session, "contrib@example.org", UserRole.contributor)
    dataset = upload_dataset(client, contributor)

    response = client.post(f"/api/v1/admin/datasets/{dataset['id']}/reanalyze", headers=admin)
    assert response.status_code == 202, response.text
    assert 0 <= response.json()["quality_score"] <= 100

    unknown = client.post(f"/api/v1/admin/datasets/{uuid.uuid4()}/reanalyze", headers=admin)
    assert unknown.status_code == 404


def test_jobs_supervision(client: TestClient, db_session: Session) -> None:
    admin = promote(client, db_session, "root@example.org", UserRole.admin)
    db_session.add_all(
        [
            Job(kind=JobKind.training, status=JobStatus.completed, queue="training", progress=100),
            Job(kind=JobKind.training, status=JobStatus.failed, queue="training", error_code="TIMEOUT"),
            Job(kind=JobKind.explanation, status=JobStatus.running, queue="xai", progress=40),
        ]
    )
    db_session.commit()

    jobs = client.get("/api/v1/admin/jobs", headers=admin).json()
    assert len(jobs) == 3

    failed = client.get(
        "/api/v1/admin/jobs", params={"status": "failed"}, headers=admin
    ).json()
    assert len(failed) == 1
    assert failed[0]["error_code"] == "TIMEOUT"

    trainings = client.get(
        "/api/v1/admin/jobs", params={"kind": "training"}, headers=admin
    ).json()
    assert len(trainings) == 2
