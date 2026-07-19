"""Import communautaire : provenance, licence, badge vérifié, éthique suggérée.

Ajoute à `datasets` :
- `source_kind` / `source_ref` — provenance et clé de déduplication (« kaggle:uciml/iris »),
  unique pour qu'un même jeu importé deux fois retombe sur l'existant.
- `license_name` — la licence Kaggle, affichée et opposable (le catalogue public redistribue).
- `is_verified` — badge « Vérifié IBIS-X » vs « Communauté ». Explicite, et NON déduit de
  `created_by IS NULL` : la suppression d'un compte remet `created_by` à NULL sans pour autant
  faire d'un import communautaire un jeu vérifié.
- `ethics_suggestions` / `ethics_reviewed_at` / `ethics_reviewed_by` — les propositions de l'IA
  sont stockées À PART des 10 critères éthiques, qui restent NULL tant qu'un humain n'a pas
  tranché. Une suggestion ne doit jamais peser dans le score éthique.

Le catalogue existant (seed) est marqué vérifié à la migration.

Revision ID: 0010
Revises: 0008
Create Date: 2026-07-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# 0009 est pris par une branche concurrente (explanation_blocks) absente de main :
# on numérote 0010 pour éviter deux heads Alembic à la fusion.
revision: str = "0010"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "datasets",
        sa.Column("source_kind", sa.String(length=20), nullable=False, server_default="upload"),
    )
    op.add_column("datasets", sa.Column("source_ref", sa.String(length=160), nullable=True))
    op.add_column("datasets", sa.Column("license_name", sa.String(length=160), nullable=True))
    op.add_column(
        "datasets",
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "datasets",
        sa.Column("ethics_suggestions", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("datasets", sa.Column("ethics_reviewed_at", sa.DateTime(), nullable=True))
    op.add_column(
        "datasets",
        sa.Column("ethics_reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_index("ix_datasets_source_ref", "datasets", ["source_ref"])
    # Unicité PARTIELLE : un même jeu Kaggle ne peut apparaître qu'une fois dans le catalogue
    # PUBLIC, mais chacun garde le droit d'en avoir sa copie privée. Une unicité globale
    # empêcherait un second utilisateur d'importer un jeu qu'un premier a gardé pour lui.
    op.create_index(
        "uq_datasets_source_ref_public",
        "datasets",
        ["source_ref"],
        unique=True,
        postgresql_where=sa.text("access = 'public'"),
    )
    op.create_index("ix_datasets_is_verified", "datasets", ["is_verified"])
    op.create_foreign_key(
        "fk_datasets_ethics_reviewed_by_users",
        "datasets",
        "users",
        ["ethics_reviewed_by"],
        ["id"],
        ondelete="SET NULL",
    )

    # Le catalogue déjà en base est le catalogue curé : il porte le badge vérifié.
    op.execute("UPDATE datasets SET is_verified = true, source_kind = 'seed'")


def downgrade() -> None:
    op.drop_constraint("fk_datasets_ethics_reviewed_by_users", "datasets", type_="foreignkey")
    op.drop_index("ix_datasets_is_verified", table_name="datasets")
    op.drop_index("uq_datasets_source_ref_public", table_name="datasets")
    op.drop_index("ix_datasets_source_ref", table_name="datasets")
    op.drop_column("datasets", "ethics_reviewed_by")
    op.drop_column("datasets", "ethics_reviewed_at")
    op.drop_column("datasets", "ethics_suggestions")
    op.drop_column("datasets", "is_verified")
    op.drop_column("datasets", "license_name")
    op.drop_column("datasets", "source_kind")
    op.drop_column("datasets", "source_ref")
