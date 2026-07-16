"""Primitives de sécurité (ADR-003) : Argon2id, JWT access, tokens opaques.

~300 lignes d'auth maison assumées — [NE PAS REPRODUIRE] fastapi-users.
"""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError

from ibis.core.config import get_settings
from ibis.core.errors import UnauthorizedError

_hasher = PasswordHasher()  # défauts argon2id (time_cost=3, memory_cost=64 MiB)

JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, password)
    except (VerifyMismatchError, VerificationError):
        return False


def create_access_token(*, user_id: uuid.UUID, role: str) -> tuple[str, int]:
    """JWT access 30 min (env) — claims sub/role/exp/iat/jti. Renvoie (token, ttl_s)."""
    settings = get_settings()
    ttl = timedelta(minutes=settings.access_token_minutes)
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + ttl,
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)
    return token, int(ttl.total_seconds())


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            get_settings().jwt_secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "role", "exp", "iat"]},
        )
    except jwt.PyJWTError as exc:
        raise UnauthorizedError("Jeton invalide ou expiré", code="INVALID_TOKEN") from exc


def generate_opaque_token() -> str:
    """Token opaque 256 bits (refresh, reset) — seul son hash SHA-256 est stocké."""
    return secrets.token_urlsafe(32)


def hash_opaque_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
