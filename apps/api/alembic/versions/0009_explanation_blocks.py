"""Explication XAI v2 : rédaction en blocs riches (CDC évolutions §2).

Ajoute `explanations.text_blocks` (JSONB nullable) : le document de blocs typés rendu
par le frontend (même contrat que le chat). `text_explanation` reste le miroir texte
lisible et le repli rétrocompatible.

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "explanations",
        sa.Column("text_blocks", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("explanations", "text_blocks")
