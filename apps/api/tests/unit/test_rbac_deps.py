"""Unitaires : hiérarchie de rôles et ownership (CDC §3.2, ARCH §7.2).

Chaque module suivant teste SES routes contre la matrice ; ici on verrouille
le comportement des gardes elles-mêmes.
"""

import uuid

import pytest

from ibis.core.errors import ForbiddenError
from ibis.modules.auth.deps import AccessClaims, require_owner_or_admin, require_role
from ibis.modules.auth.models import UserRole


def claims(role: UserRole) -> AccessClaims:
    return AccessClaims(user_id=uuid.uuid4(), role=role)


@pytest.mark.parametrize(
    ("minimum", "role", "allowed"),
    [
        (UserRole.user, UserRole.user, True),
        (UserRole.user, UserRole.contributor, True),
        (UserRole.user, UserRole.admin, True),
        (UserRole.contributor, UserRole.user, False),
        (UserRole.contributor, UserRole.contributor, True),
        (UserRole.contributor, UserRole.admin, True),
        (UserRole.admin, UserRole.user, False),
        (UserRole.admin, UserRole.contributor, False),
        (UserRole.admin, UserRole.admin, True),
    ],
)
def test_role_hierarchy(minimum: UserRole, role: UserRole, allowed: bool) -> None:
    guard = require_role(minimum)
    if allowed:
        assert guard(claims(role)).role == role
    else:
        with pytest.raises(ForbiddenError):
            guard(claims(role))


def test_owner_or_admin() -> None:
    owner = claims(UserRole.user)
    require_owner_or_admin(owner, owner.user_id)  # propriétaire → OK

    with pytest.raises(ForbiddenError):
        require_owner_or_admin(owner, uuid.uuid4())  # pas propriétaire → 403
    with pytest.raises(ForbiddenError):
        require_owner_or_admin(owner, None)  # ressource système → réservée admin

    admin = claims(UserRole.admin)
    require_owner_or_admin(admin, uuid.uuid4())  # admin → tout
    require_owner_or_admin(admin, None)
