"""Service profil utilisateur : onboarding, mise à jour, mot de passe, avatar, suppression."""

import io
from datetime import UTC, datetime

from PIL import Image
from sqlalchemy.orm import Session

from ibis.core.errors import ConflictError, ForbiddenError, InvalidInputError
from ibis.core.logging import get_logger
from ibis.core.security import hash_password, verify_password
from ibis.modules.auth import service as auth_service
from ibis.modules.auth.models import User, derive_xai_audience
from ibis.modules.auth.schemas import OnboardingRequest, ProfileUpdateRequest
from ibis.storage import get_storage

logger = get_logger(__name__)

AVATAR_MAX_BYTES = 2 * 1024 * 1024
AVATAR_SIZE = 256


def complete_onboarding(db: Session, user: User, payload: OnboardingRequest) -> User:
    """Onboarding obligatoire (CDC §4.1) — une seule fois ; modifiable ensuite via profil."""
    if user.onboarding_completed:
        raise ConflictError("Onboarding déjà complété", code="ONBOARDING_DONE")
    user.education_level = payload.education_level
    user.age = payload.age
    user.ai_familiarity = payload.ai_familiarity
    user.xai_audience = derive_xai_audience(payload.ai_familiarity)
    user.onboarding_completed_at = datetime.now(UTC)
    db.commit()
    db.refresh(user)
    return user


def update_profile(db: Session, user: User, payload: ProfileUpdateRequest) -> User:
    data = payload.model_dump(exclude_unset=True)
    explicit_audience = "xai_audience" in data
    for field, value in data.items():
        setattr(user, field, value)
    # La familiarité IA redérive le profil XAI, sauf choix explicite de l'utilisateur
    if "ai_familiarity" in data and not explicit_audience and data["ai_familiarity"] is not None:
        user.xai_audience = derive_xai_audience(data["ai_familiarity"])
    db.commit()
    db.refresh(user)
    return user


def change_password(
    db: Session, user: User, *, current_password: str | None, new_password: str
) -> None:
    """Avec mot de passe actuel requis ; un compte Google-only peut en DÉFINIR un (CDC §4.1)."""
    if user.hashed_password is not None and (
        not current_password or not verify_password(current_password, user.hashed_password)
    ):
        raise ForbiddenError("Mot de passe actuel incorrect", code="WRONG_PASSWORD")
    user.hashed_password = hash_password(new_password)
    db.commit()
    # Sécurité : toute autre session est invalidée
    auth_service.revoke_all_user_tokens(db, user.id)


def save_avatar(db: Session, user: User, content: bytes) -> User:
    """Avatar : validation par parsing effectif, normalisation 256×256 WebP (ADR-005)."""
    if len(content) > AVATAR_MAX_BYTES:
        raise InvalidInputError("Image trop lourde (max 2 Mo)", code="AVATAR_TOO_LARGE")
    try:
        probe = Image.open(io.BytesIO(content))
        probe.verify()
        source = Image.open(io.BytesIO(content))  # verify() invalide l'objet
    except Exception as exc:
        raise InvalidInputError("Fichier image invalide", code="AVATAR_INVALID") from exc

    normalized = source.convert("RGB")
    normalized.thumbnail((AVATAR_SIZE, AVATAR_SIZE))
    buffer = io.BytesIO()
    normalized.save(buffer, format="WEBP", quality=85)
    buffer.seek(0)

    key = f"avatars/{user.id}.webp"
    get_storage().save(key, buffer)
    user.avatar_path = key
    db.commit()
    db.refresh(user)
    return user


def delete_account(db: Session, user: User, *, email_confirmation: str) -> None:
    """Suppression avec confirmation par saisie de l'email (CDC §4.1), cascade BDD."""
    if auth_service.normalize_email(email_confirmation) != user.email:
        raise InvalidInputError(
            "L'email saisi ne correspond pas à votre compte", code="EMAIL_MISMATCH"
        )
    if user.avatar_path:
        get_storage().delete(user.avatar_path)
    user_id = user.id
    db.delete(user)
    db.commit()
    logger.info("user.deleted", user_id=str(user_id))
