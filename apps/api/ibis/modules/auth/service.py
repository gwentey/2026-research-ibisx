"""Service auth : comptes, sessions (refresh rotation + détection de vol), reset."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ibis.core.config import get_settings
from ibis.core.errors import ConflictError, InvalidInputError, UnauthorizedError
from ibis.core.logging import get_logger
from ibis.core.security import (
    generate_opaque_token,
    hash_opaque_token,
    hash_password,
    verify_password,
)
from ibis.modules.auth.models import PasswordResetToken, RefreshToken, User

logger = get_logger(__name__)

RESET_TOKEN_TTL_HOURS = 1


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == normalize_email(email)))


def create_user(
    db: Session,
    *,
    email: str,
    password: str | None,
    locale: str = "fr",
    given_name: str | None = None,
    family_name: str | None = None,
) -> User:
    settings = get_settings()
    if get_user_by_email(db, email) is not None:
        raise ConflictError("Un compte existe déjà avec cet email", code="EMAIL_TAKEN")
    user = User(
        email=normalize_email(email),
        hashed_password=hash_password(password) if password else None,
        locale=locale if locale in ("fr", "en") else "fr",
        given_name=given_name,
        family_name=family_name,
        credits=settings.default_credits,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("user.created", user_id=str(user.id))
    return user


def authenticate(db: Session, *, email: str, password: str) -> User:
    """Erreur générique unique : pas d'énumération d'emails possible."""
    invalid = UnauthorizedError("Email ou mot de passe incorrect", code="INVALID_CREDENTIALS")
    user = get_user_by_email(db, email)
    if user is None or user.hashed_password is None:
        raise invalid
    if not verify_password(password, user.hashed_password):
        raise invalid
    if not user.is_active:
        raise UnauthorizedError("Compte désactivé", code="ACCOUNT_DISABLED")
    return user


# --- Sessions refresh (rotation + familles) -------------------------------------------------


def issue_refresh_token(
    db: Session,
    user: User,
    *,
    family_id: uuid.UUID | None = None,
    user_agent: str | None = None,
) -> str:
    settings = get_settings()
    raw = generate_opaque_token()
    token = RefreshToken(
        user_id=user.id,
        token_hash=hash_opaque_token(raw),
        family_id=family_id or uuid.uuid4(),
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
        user_agent=(user_agent or "")[:256] or None,
    )
    db.add(token)
    db.commit()
    return raw


def rotate_refresh_token(
    db: Session, raw_token: str, *, user_agent: str | None = None
) -> tuple[User, str]:
    """Rotation : l'ancien est révoqué, un nouveau (même famille) est émis.

    Réutilisation d'un token déjà révoqué → vol présumé → révocation de TOUTE la
    famille (ADR-003).
    """
    invalid = UnauthorizedError("Session expirée, reconnectez-vous", code="INVALID_REFRESH")
    now = datetime.now(UTC)
    record = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_opaque_token(raw_token))
    )
    if record is None:
        raise invalid
    if record.revoked_at is not None:
        _revoke_family(db, record.family_id)
        logger.warning(
            "auth.refresh_reuse_detected",
            user_id=str(record.user_id),
            family_id=str(record.family_id),
        )
        raise invalid
    if record.expires_at.replace(tzinfo=UTC) < now:
        raise invalid

    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        raise invalid

    record.revoked_at = now
    db.commit()
    new_raw = issue_refresh_token(db, user, family_id=record.family_id, user_agent=user_agent)
    return user, new_raw


def revoke_refresh_token(db: Session, raw_token: str) -> None:
    record = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_opaque_token(raw_token))
    )
    if record is not None and record.revoked_at is None:
        record.revoked_at = datetime.now(UTC)
        db.commit()


def revoke_all_user_tokens(db: Session, user_id: uuid.UUID) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    db.commit()


def _revoke_family(db: Session, family_id: uuid.UUID) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    db.commit()


# --- Mot de passe oublié ---------------------------------------------------------------------


def create_reset_token(db: Session, email: str) -> tuple[User, str] | None:
    """Renvoie (user, token) si le compte existe — l'endpoint répond 204 dans tous les cas."""
    user = get_user_by_email(db, email)
    if user is None or not user.is_active:
        return None
    raw = generate_opaque_token()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_opaque_token(raw),
            expires_at=datetime.now(UTC) + timedelta(hours=RESET_TOKEN_TTL_HOURS),
        )
    )
    db.commit()
    return user, raw


def reset_password(db: Session, *, raw_token: str, new_password: str) -> User:
    now = datetime.now(UTC)
    record = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == hash_opaque_token(raw_token)
        )
    )
    if record is None or record.used_at is not None or record.expires_at.replace(tzinfo=UTC) < now:
        raise InvalidInputError("Lien de réinitialisation invalide ou expiré", code="INVALID_RESET")
    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        raise InvalidInputError("Lien de réinitialisation invalide ou expiré", code="INVALID_RESET")
    user.hashed_password = hash_password(new_password)
    record.used_at = now
    db.commit()
    # Toute session existante est invalidée après un reset
    revoke_all_user_tokens(db, user.id)
    return user
