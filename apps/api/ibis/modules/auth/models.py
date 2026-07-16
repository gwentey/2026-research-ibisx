"""Modèles auth & comptes (ARCH §6.2) : users, refresh_tokens, reset, identités OAuth."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, SmallInteger, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ibis.db.base import Base, Timestamped, UUIDPk


class UserRole(enum.StrEnum):
    user = "user"
    contributor = "contributor"
    admin = "admin"


ROLE_ORDER: dict[UserRole, int] = {UserRole.user: 0, UserRole.contributor: 1, UserRole.admin: 2}


class XaiAudience(enum.StrEnum):
    novice = "novice"
    intermediate = "intermediate"
    expert = "expert"


class EducationLevel(enum.StrEnum):
    lycee = "lycee"
    licence = "licence"
    master = "master"
    doctorat = "doctorat"
    autre = "autre"


def derive_xai_audience(ai_familiarity: int) -> XaiAudience:
    """CDC §4.1 : familiarité 1–2 → novice, 3 → intermediate, 4–5 → expert."""
    if ai_familiarity <= 2:
        return XaiAudience.novice
    if ai_familiarity == 3:
        return XaiAudience.intermediate
    return XaiAudience.expert


class User(UUIDPk, Timestamped, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    # NULL = compte « Google uniquement » (peut définir un mot de passe ensuite)
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role", values_callable=lambda e: [m.value for m in e]),
        default=UserRole.user,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    pseudo: Mapped[str | None] = mapped_column(String(64))
    avatar_path: Mapped[str | None] = mapped_column(String(255))
    given_name: Mapped[str | None] = mapped_column(String(120))
    family_name: Mapped[str | None] = mapped_column(String(120))
    locale: Mapped[str] = mapped_column(String(5), default="fr")

    # Onboarding obligatoire (CDC §4.1) — pilote l'adaptation XAI (M6)
    education_level: Mapped[EducationLevel | None] = mapped_column(
        SAEnum(
            EducationLevel, name="education_level", values_callable=lambda e: [m.value for m in e]
        )
    )
    age: Mapped[int | None] = mapped_column(SmallInteger)
    ai_familiarity: Mapped[int | None] = mapped_column(SmallInteger)
    xai_audience: Mapped[XaiAudience] = mapped_column(
        SAEnum(XaiAudience, name="xai_audience", values_callable=lambda e: [m.value for m in e]),
        default=XaiAudience.novice,
    )
    onboarding_completed_at: Mapped[datetime | None] = mapped_column()

    credits: Mapped[int] = mapped_column(Integer, default=100)

    @property
    def has_password(self) -> bool:
        return self.hashed_password is not None

    @property
    def has_avatar(self) -> bool:
        return self.avatar_path is not None

    @property
    def onboarding_completed(self) -> bool:
        return self.onboarding_completed_at is not None


class RefreshToken(UUIDPk, Base):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    # Famille de rotation : réutiliser un token révoqué révoque TOUTE la famille (vol détecté)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    expires_at: Mapped[datetime] = mapped_column()
    revoked_at: Mapped[datetime | None] = mapped_column()
    user_agent: Mapped[str | None] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(server_default="now()")


class PasswordResetToken(UUIDPk, Base):
    __tablename__ = "password_reset_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column()
    used_at: Mapped[datetime | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(server_default="now()")


class OAuthIdentity(UUIDPk, Base):
    __tablename__ = "oauth_identities"
    __table_args__ = (UniqueConstraint("provider", "subject", name="uq_oauth_provider_subject"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(20))  # 'google'
    subject: Mapped[str] = mapped_column(String(255))  # claim `sub` de l'id_token
    email: Mapped[str] = mapped_column(String(320))
    created_at: Mapped[datetime] = mapped_column(server_default="now()")
    # Aucun access/refresh token Google stocké (ADR-003)
