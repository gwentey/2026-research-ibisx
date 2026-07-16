"""Dépendances RBAC (ARCH §7.2) : claims JWT, chargement user, garde de rôle.

- `CurrentClaims` : lecture du rôle depuis le JWT, AUCUN round-trip BDD.
- `CurrentUser` : charge la ligne user (profil, crédits, is_active).
- `require_role(...)` : hiérarchie user < contributor < admin.
- Les actions admin critiques revérifient le rôle en base (`CurrentAdminVerified`).
"""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from ibis.core.errors import ForbiddenError, UnauthorizedError
from ibis.core.security import decode_access_token
from ibis.db.engine import get_db
from ibis.modules.auth.models import ROLE_ORDER, User, UserRole


@dataclass(frozen=True)
class AccessClaims:
    user_id: uuid.UUID
    role: UserRole


def get_bearer_token(request: Request) -> str:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedError("Authentification requise", code="NOT_AUTHENTICATED")
    return token


def get_current_claims(request: Request) -> AccessClaims:
    payload = decode_access_token(get_bearer_token(request))
    try:
        return AccessClaims(user_id=uuid.UUID(payload["sub"]), role=UserRole(payload["role"]))
    except (KeyError, ValueError) as exc:
        raise UnauthorizedError("Jeton invalide", code="INVALID_TOKEN") from exc


CurrentClaims = Annotated[AccessClaims, Depends(get_current_claims)]


def get_current_user(claims: CurrentClaims, db: Annotated[Session, Depends(get_db)]) -> User:
    user = db.get(User, claims.user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Compte introuvable ou désactivé", code="ACCOUNT_DISABLED")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(minimum: UserRole) -> Callable[[AccessClaims], AccessClaims]:
    """Garde de rôle par claims (sans BDD). Usage : Depends(require_role(UserRole.admin))."""

    def dependency(claims: CurrentClaims) -> AccessClaims:
        if ROLE_ORDER[claims.role] < ROLE_ORDER[minimum]:
            raise ForbiddenError("Droits insuffisants", code="FORBIDDEN")
        return claims

    return dependency


def get_verified_admin(claims: CurrentClaims, db: Annotated[Session, Depends(get_db)]) -> User:
    """Pour les actions admin critiques : le rôle est revérifié EN BASE (ARCH §7.2)."""
    if ROLE_ORDER[claims.role] < ROLE_ORDER[UserRole.admin]:
        raise ForbiddenError("Droits insuffisants", code="FORBIDDEN")
    user = db.get(User, claims.user_id)
    if user is None or not user.is_active or user.role != UserRole.admin:
        raise ForbiddenError("Droits insuffisants", code="FORBIDDEN")
    return user


CurrentAdminVerified = Annotated[User, Depends(get_verified_admin)]


def require_owner_or_admin(claims: AccessClaims, owner_id: uuid.UUID | None) -> None:
    """Ownership : autorise le propriétaire de la ressource ou un admin (CDC §3.2)."""
    if claims.role == UserRole.admin:
        return
    if owner_id is None or owner_id != claims.user_id:
        raise ForbiddenError("Vous n'êtes pas propriétaire de cette ressource", code="NOT_OWNER")
