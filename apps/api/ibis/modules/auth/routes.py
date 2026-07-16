"""Routes /auth (ADR-003) : register, login, refresh, logout, reset, Google OIDC."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from ibis.core.config import Settings, get_settings
from ibis.core.mailer import send_email
from ibis.core.ratelimit import rate_limit
from ibis.core.security import create_access_token
from ibis.db.engine import get_db
from ibis.modules.auth import google, service
from ibis.modules.auth.models import User
from ibis.modules.auth.schemas import (
    ForgotPasswordRequest,
    GoogleAuthorizeResponse,
    GoogleExchangeRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserRead,
)

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "ibis_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth"

# Exporté séparément pour être surchargé dans les tests (dependency_overrides)
auth_limiter = rate_limit("auth", times=10, seconds=60)
auth_rate_limit = Depends(auth_limiter)

DbDep = Annotated[Session, Depends(get_db)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def _set_refresh_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=settings.refresh_token_days * 24 * 3600,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
    )


def _clear_refresh_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        REFRESH_COOKIE,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
    )


def _token_response(
    response: Response,
    db: Session,
    user: User,
    settings: Settings,
    request: Request,
    *,
    new_refresh: str | None = None,
) -> TokenResponse:
    access, expires_in = create_access_token(user_id=user.id, role=user.role.value)
    refresh = new_refresh or service.issue_refresh_token(
        db, user, user_agent=request.headers.get("user-agent")
    )
    _set_refresh_cookie(response, refresh, settings)
    return TokenResponse(
        access_token=access, expires_in=expires_in, user=UserRead.model_validate(user)
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=201,
    operation_id="register",
    dependencies=[auth_rate_limit],
)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: DbDep,
    settings: SettingsDep,
) -> TokenResponse:
    """Inscription email + mot de passe, auto-connexion (CDC §4.1)."""
    locale = "en" if (request.headers.get("accept-language") or "").startswith("en") else "fr"
    user = service.create_user(db, email=payload.email, password=payload.password, locale=locale)
    return _token_response(response, db, user, settings, request)


@router.post(
    "/login",
    response_model=TokenResponse,
    operation_id="login",
    dependencies=[auth_rate_limit],
)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: DbDep,
    settings: SettingsDep,
) -> TokenResponse:
    user = service.authenticate(db, email=payload.email, password=payload.password)
    return _token_response(response, db, user, settings, request)


@router.post("/refresh", response_model=TokenResponse, operation_id="refreshToken")
def refresh(
    request: Request, response: Response, db: DbDep, settings: SettingsDep
) -> TokenResponse:
    """Rotation du refresh token (cookie httpOnly) → nouvel access + nouveau refresh."""
    raw = request.cookies.get(REFRESH_COOKIE, "")
    user, new_refresh = service.rotate_refresh_token(
        db, raw, user_agent=request.headers.get("user-agent")
    )
    return _token_response(response, db, user, settings, request, new_refresh=new_refresh)


@router.post("/logout", status_code=204, operation_id="logout")
def logout(request: Request, response: Response, db: DbDep, settings: SettingsDep) -> None:
    raw = request.cookies.get(REFRESH_COOKIE, "")
    if raw:
        service.revoke_refresh_token(db, raw)
    _clear_refresh_cookie(response, settings)


@router.post(
    "/forgot-password",
    status_code=204,
    operation_id="forgotPassword",
    dependencies=[auth_rate_limit],
)
def forgot_password(payload: ForgotPasswordRequest, db: DbDep) -> None:
    """Répond toujours 204 (pas d'énumération). Sans SMTP le lien est loggé (dev)."""
    result = service.create_reset_token(db, payload.email)
    if result is not None:
        user, token = result
        reset_url = f"/reset-password?token={token}"
        send_email(
            to=user.email,
            subject="IBIS-X — Réinitialisation de votre mot de passe",
            body=(
                "Pour définir un nouveau mot de passe, ouvrez ce lien (valable 1 h) :\n"
                f"{reset_url}\n\n"
                "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email."
            ),
        )


@router.post(
    "/reset-password",
    status_code=204,
    operation_id="resetPassword",
    dependencies=[auth_rate_limit],
)
def reset_password(payload: ResetPasswordRequest, db: DbDep) -> None:
    service.reset_password(db, raw_token=payload.token, new_password=payload.new_password)


@router.get(
    "/google/authorize",
    response_model=GoogleAuthorizeResponse,
    operation_id="googleAuthorize",
    dependencies=[auth_rate_limit],
)
def google_authorize() -> GoogleAuthorizeResponse:
    url, state = google.build_authorization_url()
    return GoogleAuthorizeResponse(authorization_url=url, state=state)


@router.post(
    "/google/exchange",
    response_model=TokenResponse,
    operation_id="googleExchange",
    dependencies=[auth_rate_limit],
)
def google_exchange(
    payload: GoogleExchangeRequest,
    request: Request,
    response: Response,
    db: DbDep,
    settings: SettingsDep,
) -> TokenResponse:
    """Échange le code Google, valide l'id_token, émet NOS jetons (ADR-003)."""
    user = google.exchange_code(db, code=payload.code, state=payload.state)
    return _token_response(response, db, user, settings, request)
