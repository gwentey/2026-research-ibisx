"""Rate limiting fixe par fenêtre (Redis INCR + EXPIRE) — appliqué sur /auth/* (ARCH §7.1).

Implémentation volontairement minimale (P7) plutôt qu'une dépendance lourde.
En cas d'indisponibilité Redis, on laisse passer (fail-open) : la disponibilité
du service prime, l'authentification reste protégée par Argon2id.
"""

import contextlib
from collections.abc import Callable
from typing import cast

from fastapi import Request

from ibis.core.config import get_settings
from ibis.core.errors import QuotaExceededError
from ibis.core.redis import get_sync_redis


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and get_settings().is_production:
        # Derrière Caddy (prod), la première IP de la chaîne est le client réel
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_quota(
    scope: str, identity: str, *, times: int, seconds: int, message: str, code: str = "RATE_LIMITED"
) -> None:
    """Compteur à fenêtre fixe sur une identité quelconque (IP, utilisateur…).

    Fail-open si Redis est indisponible : la disponibilité du service prime.
    """
    key = f"ibis:ratelimit:{scope}:{identity}"
    current: int | None = None
    with contextlib.suppress(Exception):
        redis = get_sync_redis()
        current = int(cast(int, redis.incr(key)))
        if current == 1:
            redis.expire(key, seconds)
    if current is not None and current > times:
        raise QuotaExceededError(message, code=code)


def rate_limit(scope: str, *, times: int = 10, seconds: int = 60) -> Callable[[Request], None]:
    """Limiteur par IP — pour les routes NON authentifiées (`/auth/*`)."""

    def dependency(request: Request) -> None:
        enforce_quota(
            scope,
            client_ip(request),
            times=times,
            seconds=seconds,
            message="Trop de tentatives, réessayez dans une minute",
        )

    return dependency
