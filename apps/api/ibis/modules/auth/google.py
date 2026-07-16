"""Connexion Google en OIDC direct (ADR-003) — authlib, PKCE, aucun IDP tiers.

Flux : GET /auth/google/authorize (URL + state + PKCE, verifier en Redis 10 min)
→ callback front → POST /auth/google/exchange (échange code, validation id_token
signé + email_verified, upsert identité, liaison par email vérifié) → NOS JWT.
"""

import secrets
from typing import Any

import httpx
from authlib.integrations.httpx_client import OAuth2Client
from authlib.jose import JsonWebToken
from sqlalchemy import select
from sqlalchemy.orm import Session

from ibis.core.config import get_settings
from ibis.core.errors import InvalidInputError, ServiceUnavailableError, UnauthorizedError
from ibis.core.logging import get_logger
from ibis.core.redis import get_sync_redis
from ibis.modules.auth import service
from ibis.modules.auth.models import OAuthIdentity, User

logger = get_logger(__name__)

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")
STATE_TTL_SECONDS = 600
SCOPES = "openid email profile"


def _state_key(state: str) -> str:
    return f"ibis:oauth:google:{state}"


def build_authorization_url() -> tuple[str, str]:
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        raise ServiceUnavailableError(
            "Connexion Google non configurée sur cette instance", code="GOOGLE_NOT_CONFIGURED"
        )
    state = secrets.token_urlsafe(24)
    nonce = secrets.token_urlsafe(24)
    client = OAuth2Client(
        client_id=settings.google_client_id,
        redirect_uri=settings.oauth_redirect_url,
        scope=SCOPES,
        code_challenge_method="S256",
    )
    code_verifier = secrets.token_urlsafe(48)
    url, _ = client.create_authorization_url(
        GOOGLE_AUTH_ENDPOINT,
        state=state,
        nonce=nonce,
        code_verifier=code_verifier,
        access_type="online",
        prompt="select_account",
    )
    get_sync_redis().setex(_state_key(state), STATE_TTL_SECONDS, f"{code_verifier}:{nonce}")
    return url, state


def _pop_state(state: str) -> tuple[str, str]:
    redis = get_sync_redis()
    key = _state_key(state)
    value = redis.get(key)
    if value is None:
        raise InvalidInputError("État OAuth inconnu ou expiré", code="INVALID_OAUTH_STATE")
    redis.delete(key)
    verifier, _, nonce = str(value).partition(":")
    return verifier, nonce


def _fetch_google_jwks() -> dict[str, Any]:
    response = httpx.get(GOOGLE_JWKS_URI, timeout=10.0)
    response.raise_for_status()
    return response.json()


def exchange_code(db: Session, *, code: str, state: str) -> User:
    """Échange le code, valide l'id_token et renvoie l'utilisateur (créé ou lié)."""
    settings = get_settings()
    code_verifier, nonce = _pop_state(state)

    token_response = httpx.post(
        GOOGLE_TOKEN_ENDPOINT,
        data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.oauth_redirect_url,
            "grant_type": "authorization_code",
            "code_verifier": code_verifier,
        },
        timeout=15.0,
    )
    if token_response.status_code != 200:
        logger.warning("google.exchange_failed", status=token_response.status_code)
        raise UnauthorizedError("Échange Google refusé", code="GOOGLE_EXCHANGE_FAILED")
    id_token = token_response.json().get("id_token")
    if not id_token:
        raise UnauthorizedError("Réponse Google invalide", code="GOOGLE_EXCHANGE_FAILED")

    claims = _validate_id_token(id_token, nonce=nonce)
    return upsert_google_user(db, claims)


def _validate_id_token(id_token: str, *, nonce: str) -> dict[str, Any]:
    settings = get_settings()
    jwt_decoder = JsonWebToken(["RS256"])
    claims = jwt_decoder.decode(id_token, _fetch_google_jwks())
    claims.validate()

    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise UnauthorizedError("Émetteur id_token invalide", code="GOOGLE_TOKEN_INVALID")
    if claims.get("aud") != settings.google_client_id:
        raise UnauthorizedError("Audience id_token invalide", code="GOOGLE_TOKEN_INVALID")
    if nonce and claims.get("nonce") != nonce:
        raise UnauthorizedError("Nonce id_token invalide", code="GOOGLE_TOKEN_INVALID")
    if not claims.get("email_verified", False):
        raise UnauthorizedError(
            "L'email Google doit être vérifié pour se connecter", code="GOOGLE_EMAIL_UNVERIFIED"
        )
    return dict(claims)


def upsert_google_user(db: Session, claims: dict[str, Any]) -> User:
    """Liaison par email vérifié (pas de doublon) sinon création — ADR-003."""
    subject = str(claims["sub"])
    email = service.normalize_email(str(claims["email"]))

    identity = db.scalar(
        select(OAuthIdentity).where(
            OAuthIdentity.provider == "google", OAuthIdentity.subject == subject
        )
    )
    if identity is not None:
        user = db.get(User, identity.user_id)
        if user is None or not user.is_active:
            raise UnauthorizedError("Compte désactivé", code="ACCOUNT_DISABLED")
        return user

    user = service.get_user_by_email(db, email)
    if user is None:
        user = service.create_user(
            db,
            email=email,
            password=None,  # compte « Google uniquement »
            locale=str(claims.get("locale", "fr"))[:2],
            given_name=claims.get("given_name"),
            family_name=claims.get("family_name"),
        )
    if not user.is_active:
        raise UnauthorizedError("Compte désactivé", code="ACCOUNT_DISABLED")

    db.add(OAuthIdentity(user_id=user.id, provider="google", subject=subject, email=email))
    db.commit()
    logger.info("user.google_linked", user_id=str(user.id))
    return user
