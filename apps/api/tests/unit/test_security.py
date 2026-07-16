"""Unitaires : primitives de sécurité (ADR-003)."""

import uuid
from datetime import UTC, datetime, timedelta

import jwt as pyjwt
import pytest

from ibis.core.config import get_settings
from ibis.core.errors import UnauthorizedError
from ibis.core.security import (
    JWT_ALGORITHM,
    create_access_token,
    decode_access_token,
    generate_opaque_token,
    hash_opaque_token,
    hash_password,
    verify_password,
)
from ibis.modules.auth.models import XaiAudience, derive_xai_audience


def test_password_hash_roundtrip() -> None:
    hashed = hash_password("correct horse battery staple")
    assert hashed.startswith("$argon2id$")
    assert verify_password("correct horse battery staple", hashed)
    assert not verify_password("wrong", hashed)


def test_access_token_roundtrip() -> None:
    user_id = uuid.uuid4()
    token, expires_in = create_access_token(user_id=user_id, role="contributor")
    assert expires_in == get_settings().access_token_minutes * 60
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["role"] == "contributor"
    assert payload["jti"]


def test_expired_token_rejected() -> None:
    now = datetime.now(UTC)
    token = pyjwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "role": "user",
            "iat": now - timedelta(hours=1),
            "exp": now - timedelta(minutes=1),
        },
        get_settings().jwt_secret,
        algorithm=JWT_ALGORITHM,
    )
    with pytest.raises(UnauthorizedError):
        decode_access_token(token)


def test_tampered_token_rejected() -> None:
    token, _ = create_access_token(user_id=uuid.uuid4(), role="user")
    forged = pyjwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "role": "admin",
            "iat": datetime.now(UTC),
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        },
        "not-the-real-secret",
        algorithm=JWT_ALGORITHM,
    )
    with pytest.raises(UnauthorizedError):
        decode_access_token(forged)
    with pytest.raises(UnauthorizedError):
        decode_access_token(token[:-2] + "xx")


def test_opaque_token_hashing() -> None:
    raw = generate_opaque_token()
    assert len(raw) >= 43  # 256 bits url-safe
    assert hash_opaque_token(raw) == hash_opaque_token(raw)
    assert hash_opaque_token(raw) != hash_opaque_token(generate_opaque_token())


@pytest.mark.parametrize(
    ("familiarity", "expected"),
    [
        (1, XaiAudience.novice),
        (2, XaiAudience.novice),
        (3, XaiAudience.intermediate),
        (4, XaiAudience.expert),
        (5, XaiAudience.expert),
    ],
)
def test_derive_xai_audience(familiarity: int, expected: XaiAudience) -> None:
    """CDC §4.1 : ai_familiarity 1–2 → novice, 3 → intermediate, 4–5 → expert."""
    assert derive_xai_audience(familiarity) == expected
