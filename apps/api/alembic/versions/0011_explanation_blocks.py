"""Explication XAI v2 : rédaction en blocs riches (CDC évolutions §2).

Ajoute `explanations.text_blocks` (JSONB nullable) : le document de blocs typés rendu
par le frontend (même contrat que le chat). `text_explanation` reste le miroir texte
lisible et le repli rétrocompatible.

`IF NOT EXISTS` : cette migration s'appelait 0009 (tête concurrente de 0010, import
Kaggle) avant d'être linéarisée derrière elle — les bases de dev ayant déjà appliqué
l'ancienne 0009 portent la colonne sans l'entrée d'historique correspondante.

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-19
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE explanations ADD COLUMN IF NOT EXISTS text_blocks JSONB")


def downgrade() -> None:
    op.execute("ALTER TABLE explanations DROP COLUMN IF EXISTS text_blocks")
