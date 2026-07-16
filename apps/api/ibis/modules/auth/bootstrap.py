"""Création du premier admin (ARCH §7.2) : CLI `ibis create-admin` ou variables d'env.

[NE PAS REPRODUIRE] l'endpoint public `/admin/temporary-grant` de la v1.
"""

from sqlalchemy import select

from ibis.core.config import get_settings
from ibis.core.logging import get_logger
from ibis.db.engine import open_session
from ibis.modules.auth import service
from ibis.modules.auth.models import User, UserRole

logger = get_logger(__name__)


def ensure_initial_admin() -> None:
    """Au premier boot : crée l'admin depuis INITIAL_ADMIN_EMAIL/PASSWORD si aucun admin."""
    settings = get_settings()
    if not settings.initial_admin_email or not settings.initial_admin_password:
        return
    db = open_session()
    try:
        has_admin = db.scalar(select(User.id).where(User.role == UserRole.admin).limit(1))
        if has_admin is not None:
            return
        existing = service.get_user_by_email(db, settings.initial_admin_email)
        if existing is not None:
            existing.role = UserRole.admin
            db.commit()
            logger.info("bootstrap.admin_promoted", email=settings.initial_admin_email)
            return
        user = service.create_user(
            db, email=settings.initial_admin_email, password=settings.initial_admin_password
        )
        user.role = UserRole.admin
        db.commit()
        logger.info("bootstrap.admin_created", email=settings.initial_admin_email)
    except Exception:
        logger.exception("bootstrap.admin_failed")
    finally:
        db.close()


def create_admin(email: str, password: str | None = None) -> User:
    """Cœur de la commande CLI `ibis create-admin` : crée ou promeut un compte."""
    db = open_session()
    try:
        user = service.get_user_by_email(db, email)
        if user is None:
            if not password:
                raise ValueError("Un mot de passe est requis pour créer un nouveau compte admin")
            user = service.create_user(db, email=email, password=password)
        user.role = UserRole.admin
        db.commit()
        db.refresh(user)
        return user
    finally:
        db.close()
