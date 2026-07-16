"""Intégration : connexion Google OIDC (ADR-003) — Google est simulé, notre logique est réelle."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from ibis.core.errors import UnauthorizedError
from ibis.modules.auth import google


def google_claims(**overrides: Any) -> dict[str, Any]:
    claims: dict[str, Any] = {
        "sub": "google-sub-123",
        "email": "gaston@gmail.com",
        "email_verified": True,
        "given_name": "Gaston",
        "family_name": "Lagaffe",
        "locale": "fr",
    }
    claims.update(overrides)
    return claims


def test_upsert_creates_google_only_account(db_session: Session) -> None:
    user = google.upsert_google_user(db_session, google_claims())
    assert user.email == "gaston@gmail.com"
    assert user.hashed_password is None  # compte « Google uniquement »
    assert user.onboarding_completed is False
    # Second login même sub → même compte, pas de doublon
    again = google.upsert_google_user(db_session, google_claims())
    assert again.id == user.id


def test_upsert_links_existing_account_by_verified_email(
    client: TestClient, db_session: Session
) -> None:
    client.post(
        "/api/v1/auth/register", json={"email": "gaston@gmail.com", "password": "s3cret-pass"}
    )
    user = google.upsert_google_user(db_session, google_claims())
    assert user.hashed_password is not None  # compte existant lié, pas de doublon
    assert user.email == "gaston@gmail.com"


def test_exchange_endpoint_issues_our_tokens(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """L'endpoint émet NOS jetons (access + refresh cookie), identiques au flux mot de passe."""

    def fake_exchange(db: Session, *, code: str, state: str) -> Any:
        assert code == "auth-code"
        assert state == "the-state"
        return google.upsert_google_user(db, google_claims())

    monkeypatch.setattr(google, "exchange_code", fake_exchange)
    response = client.post(
        "/api/v1/auth/google/exchange", json={"code": "auth-code", "state": "the-state"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["user"]["email"] == "gaston@gmail.com"
    assert body["user"]["has_password"] is False
    assert client.cookies.get("ibis_refresh")


def test_unverified_email_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from ibis.core.config import get_settings

    monkeypatch.setattr(google, "_fetch_google_jwks", lambda: {"keys": []})

    class FakeClaims(dict):
        def validate(self) -> None: ...

    fake = FakeClaims(
        google_claims(
            email_verified=False,
            iss="https://accounts.google.com",
            aud=get_settings().google_client_id,
        )
    )
    monkeypatch.setattr(google.JsonWebToken, "decode", lambda self, t, k: fake)
    with pytest.raises(UnauthorizedError, match="vérifié"):
        google._validate_id_token("dummy", nonce="")


def test_state_unknown_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/google/exchange", json={"code": "auth-code", "state": "forged-state"}
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "INVALID_OAUTH_STATE"
