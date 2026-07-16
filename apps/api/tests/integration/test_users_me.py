"""Intégration : profil, onboarding, mot de passe, suppression (CDC §4)."""

import io

from fastapi.testclient import TestClient
from PIL import Image


def bearer(client: TestClient, email: str = "alice@example.org") -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register", json={"email": email, "password": "s3cret-pass"}
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_me_requires_auth(client: TestClient) -> None:
    assert client.get("/api/v1/users/me").status_code == 401
    assert (
        client.get("/api/v1/users/me", headers={"Authorization": "Bearer forged"}).status_code
        == 401
    )


def test_onboarding_flow(client: TestClient) -> None:
    headers = bearer(client)
    me = client.get("/api/v1/users/me", headers=headers).json()
    assert me["onboarding_completed"] is False

    done = client.post(
        "/api/v1/users/me/onboarding",
        json={"education_level": "master", "age": 24, "ai_familiarity": 2},
        headers=headers,
    )
    assert done.status_code == 200
    body = done.json()
    assert body["onboarding_completed"] is True
    assert body["xai_audience"] == "novice"  # familiarité 2 → novice (CDC §4.1)

    # Une seconde fois → 409 (modifiable ensuite via PATCH /users/me)
    again = client.post(
        "/api/v1/users/me/onboarding",
        json={"education_level": "master", "age": 24, "ai_familiarity": 5},
        headers=headers,
    )
    assert again.status_code == 409


def test_onboarding_validation(client: TestClient) -> None:
    headers = bearer(client)
    bad_age = client.post(
        "/api/v1/users/me/onboarding",
        json={"education_level": "master", "age": 12, "ai_familiarity": 3},
        headers=headers,
    )
    assert bad_age.status_code == 422
    bad_level = client.post(
        "/api/v1/users/me/onboarding",
        json={"education_level": "college", "age": 20, "ai_familiarity": 3},
        headers=headers,
    )
    assert bad_level.status_code == 422


def test_profile_update_rederives_audience(client: TestClient) -> None:
    headers = bearer(client)
    updated = client.patch(
        "/api/v1/users/me",
        json={"pseudo": "alice", "locale": "en", "ai_familiarity": 5},
        headers=headers,
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["pseudo"] == "alice"
    assert body["locale"] == "en"
    assert body["xai_audience"] == "expert"

    # Choix explicite de l'audience : pas de redérivation
    explicit = client.patch(
        "/api/v1/users/me", json={"xai_audience": "intermediate"}, headers=headers
    ).json()
    assert explicit["xai_audience"] == "intermediate"


def test_change_password_requires_current(client: TestClient) -> None:
    headers = bearer(client)
    wrong = client.patch(
        "/api/v1/users/me/password",
        json={"current_password": "bad-guess", "new_password": "brand-new-pass"},
        headers=headers,
    )
    assert wrong.status_code == 403

    ok = client.patch(
        "/api/v1/users/me/password",
        json={"current_password": "s3cret-pass", "new_password": "brand-new-pass"},
        headers=headers,
    )
    assert ok.status_code == 204
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": "alice@example.org", "password": "brand-new-pass"},
        ).status_code
        == 200
    )


def test_avatar_upload_and_fetch(client: TestClient) -> None:
    headers = bearer(client)
    image = Image.new("RGB", (600, 600), color=(30, 90, 200))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)

    upload = client.put(
        "/api/v1/users/me/avatar",
        files={"file": ("me.png", buffer, "image/png")},
        headers=headers,
    )
    assert upload.status_code == 200
    assert upload.json()["has_avatar"] is True

    fetched = client.get("/api/v1/users/me/avatar", headers=headers)
    assert fetched.status_code == 200
    assert fetched.headers["content-type"] == "image/webp"
    served = Image.open(io.BytesIO(fetched.content))
    assert max(served.size) <= 256  # normalisé (ADR-005)


def test_avatar_rejects_non_image(client: TestClient) -> None:
    headers = bearer(client)
    bad = client.put(
        "/api/v1/users/me/avatar",
        files={"file": ("evil.png", io.BytesIO(b"#!/bin/sh\nrm -rf /"), "image/png")},
        headers=headers,
    )
    assert bad.status_code == 422
    assert bad.json()["detail"]["code"] == "AVATAR_INVALID"


def test_delete_account_with_confirmation(client: TestClient) -> None:
    headers = bearer(client)
    mismatch = client.post(
        "/api/v1/users/me/delete", json={"email_confirmation": "wrong@example.org"}, headers=headers
    )
    assert mismatch.status_code == 422

    deleted = client.post(
        "/api/v1/users/me/delete",
        json={"email_confirmation": "alice@example.org"},
        headers=headers,
    )
    assert deleted.status_code == 204
    # Le compte n'existe plus : l'access token encore valide ne résout plus personne
    assert client.get("/api/v1/users/me", headers=headers).status_code == 401
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": "alice@example.org", "password": "s3cret-pass"}
        ).status_code
        == 401
    )
