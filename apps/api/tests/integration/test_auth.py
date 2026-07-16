"""Intégration : inscription, connexion, rotation refresh, détection de vol, reset."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

REFRESH_COOKIE = "ibis_refresh"


def register(client: TestClient, email: str = "alice@example.org", password: str = "s3cret-pass"):
    return client.post("/api/v1/auth/register", json={"email": email, "password": password})


def test_register_auto_login(client: TestClient) -> None:
    response = register(client)
    assert response.status_code == 201
    body = response.json()
    assert body["access_token"]
    assert body["user"]["email"] == "alice@example.org"
    assert body["user"]["role"] == "user"
    assert body["user"]["credits"] == 100
    assert body["user"]["onboarding_completed"] is False
    assert client.cookies.get(REFRESH_COOKIE)


def test_register_duplicate_email_conflict(client: TestClient) -> None:
    register(client)
    response = register(client)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "EMAIL_TAKEN"


def test_register_weak_password_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register", json={"email": "bob@example.org", "password": "short"}
    )
    assert response.status_code == 422


def test_login_ok_and_wrong_password(client: TestClient) -> None:
    register(client)
    ok = client.post(
        "/api/v1/auth/login", json={"email": "alice@example.org", "password": "s3cret-pass"}
    )
    assert ok.status_code == 200
    ko = client.post(
        "/api/v1/auth/login", json={"email": "alice@example.org", "password": "nope-nope"}
    )
    assert ko.status_code == 401
    assert ko.json()["detail"]["code"] == "INVALID_CREDENTIALS"
    unknown = client.post(
        "/api/v1/auth/login", json={"email": "ghost@example.org", "password": "whatever-8"}
    )
    assert unknown.status_code == 401
    assert unknown.json()["detail"]["code"] == "INVALID_CREDENTIALS"


def test_refresh_rotation_and_reuse_detection(client: TestClient) -> None:
    """ADR-003 : rotation à chaque usage ; réutilisation → famille entière révoquée."""
    register(client)
    first_refresh = client.cookies.get(REFRESH_COOKIE)

    rotated = client.post("/api/v1/auth/refresh")
    assert rotated.status_code == 200
    second_refresh = client.cookies.get(REFRESH_COOKIE)
    assert second_refresh != first_refresh

    # Rejouer l'ANCIEN cookie (vol simulé) → 401 + révocation de la famille
    client.cookies.set(REFRESH_COOKIE, first_refresh, path="/api/v1/auth")
    replayed = client.post("/api/v1/auth/refresh")
    assert replayed.status_code == 401

    # Le token le plus récent est mort lui aussi (famille révoquée)
    client.cookies.set(REFRESH_COOKIE, second_refresh, path="/api/v1/auth")
    after_theft = client.post("/api/v1/auth/refresh")
    assert after_theft.status_code == 401


def test_logout_revokes_refresh(client: TestClient) -> None:
    register(client)
    refresh_value = client.cookies.get(REFRESH_COOKIE)
    assert client.post("/api/v1/auth/logout").status_code == 204
    client.cookies.set(REFRESH_COOKIE, refresh_value, path="/api/v1/auth")
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_forgot_and_reset_password_flow(client: TestClient, db_session: Session) -> None:
    from ibis.core.security import hash_opaque_token  # noqa: F401 (documentation du mécanisme)
    from ibis.modules.auth import service

    register(client)
    # 204 même pour un email inconnu (pas d'énumération)
    assert (
        client.post("/api/v1/auth/forgot-password", json={"email": "ghost@example.org"}).status_code
        == 204
    )
    # On génère le token via le service (l'email n'est pas interceptable en test)
    result = service.create_reset_token(db_session, "alice@example.org")
    assert result is not None
    _, token = result

    reset = client.post(
        "/api/v1/auth/reset-password", json={"token": token, "new_password": "new-pass-123"}
    )
    assert reset.status_code == 204

    # Ancien mot de passe refusé, nouveau accepté, anciennes sessions révoquées
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": "alice@example.org", "password": "s3cret-pass"}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": "alice@example.org", "password": "new-pass-123"}
        ).status_code
        == 200
    )
    # Token de reset à usage unique
    again = client.post(
        "/api/v1/auth/reset-password", json={"token": token, "new_password": "other-pass-123"}
    )
    assert again.status_code == 422
    assert again.json()["detail"]["code"] == "INVALID_RESET"


def test_rate_limit_on_auth(rate_limited_client: TestClient) -> None:
    """CDC §12.3 / ARCH §7.1 : 10/min/IP sur /auth/* → 429 au-delà."""
    for _ in range(10):
        rate_limited_client.post(
            "/api/v1/auth/login", json={"email": "x@example.org", "password": "whatever-8"}
        )
    blocked = rate_limited_client.post(
        "/api/v1/auth/login", json={"email": "x@example.org", "password": "whatever-8"}
    )
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "RATE_LIMITED"
