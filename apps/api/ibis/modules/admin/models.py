"""Traçabilité des actions d'administration (ARCH §6.2 [SHOULD])."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ibis.db.base import Base, UUIDPk


class AuditEvent(UUIDPk, Base):
    __tablename__ = "audit_events"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)  # l'admin acteur
    action: Mapped[str] = mapped_column(String(50))  # role_changed, credits_granted, …
    entity: Mapped[str] = mapped_column(String(30))  # user | dataset | ethical_template
    entity_id: Mapped[str] = mapped_column(String(64))
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    ts: Mapped[datetime] = mapped_column(server_default=func.now(), index=True)
