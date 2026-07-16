"""Modèle projet (CDC §7, ARCH §6.2) — conteneur : critères + pondérations + expériences."""

import uuid
from typing import Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ibis.db.base import Base, Timestamped, UUIDPk


class Project(UUIDPk, Timestamped, Base):
    __tablename__ = "projects"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    # Critères au format DatasetFilters (JSON) — mêmes filtres que le catalogue (P3)
    criteria: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    # Pondérations {criterion_name: weight} — normalisées si Σ > 1 (CDC §7.2)
    weights: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
