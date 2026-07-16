"""Catalogue M2 : datasets (GIN domain/task, éthique tristate), fichiers, colonnes, templates.

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ETHICAL = (
    "informed_consent",
    "transparency",
    "user_control",
    "equity_non_discrimination",
    "security_measures_in_place",
    "data_quality_documented",
    "anonymization_applied",
    "record_keeping_policy_exists",
    "purpose_limitation_respected",
    "accountability_defined",
)


def upgrade() -> None:
    op.create_table(
        "datasets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("dataset_name", sa.String(120), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("year", sa.SmallInteger(), nullable=True),
        sa.Column("objective", sa.Text(), nullable=True),
        sa.Column("sources", sa.Text(), nullable=True),
        sa.Column("storage_uri", sa.String(512), nullable=True),
        sa.Column("documentation_link", sa.String(512), nullable=True),
        sa.Column("citation_link", sa.String(512), nullable=True),
        sa.Column("num_citations", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("access", sa.String(20), nullable=False, server_default="public"),
        sa.Column("availability", sa.String(50), nullable=True),
        sa.Column("metadata_provided_with_dataset", sa.Boolean(), nullable=True),
        sa.Column("external_documentation_available", sa.Boolean(), nullable=True),
        sa.Column("instances_number", sa.BigInteger(), nullable=True),
        sa.Column("features_number", sa.Integer(), nullable=True),
        sa.Column("features_description", sa.Text(), nullable=True),
        sa.Column("domain", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("task", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("split", sa.Boolean(), nullable=True),
        sa.Column("temporal_factors", sa.Boolean(), nullable=True),
        sa.Column("has_missing_values", sa.Boolean(), nullable=True),
        sa.Column("global_missing_percentage", sa.Float(), nullable=True),
        sa.Column("missing_values_description", sa.Text(), nullable=True),
        sa.Column("missing_values_handling_method", sa.String(120), nullable=True),
        sa.Column("representativity_level", sa.String(20), nullable=True),
        sa.Column("representativity_description", sa.Text(), nullable=True),
        sa.Column("sample_balance_level", sa.String(30), nullable=True),
        sa.Column("sample_balance_description", sa.Text(), nullable=True),
        *[sa.Column(name, sa.Boolean(), nullable=True) for name in ETHICAL],
        sa.Column("ai_guide", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_datasets_dataset_name", "datasets", ["dataset_name"], unique=True)
    op.create_index("ix_datasets_display_name", "datasets", ["display_name"])
    op.create_index("ix_datasets_created_by", "datasets", ["created_by"])
    op.create_index("ix_datasets_domain_gin", "datasets", ["domain"], postgresql_using="gin")
    op.create_index("ix_datasets_task_gin", "datasets", ["task"], postgresql_using="gin")

    op.create_table(
        "dataset_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "dataset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("datasets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("storage_key", sa.String(512), nullable=False),
        sa.Column("logical_role", sa.String(20), nullable=False, server_default="data_file"),
        sa.Column("format", sa.String(20), nullable=False, server_default="parquet"),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("row_count", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_dataset_files_dataset_id", "dataset_files", ["dataset_id"])

    op.create_table(
        "dataset_columns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "file_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("dataset_files.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("dtype_original", sa.String(50), nullable=False),
        sa.Column("dtype_interpreted", sa.String(20), nullable=False),
        sa.Column("is_nullable", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_pii", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "example_values", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"
        ),
        sa.Column("position", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("stats", postgresql.JSONB(), nullable=False, server_default="{}"),
    )
    op.create_index("ix_dataset_columns_file_id", "dataset_columns", ["file_id"])

    op.create_table(
        "ethical_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("domain", sa.String(50), nullable=False),
        sa.Column("defaults", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_ethical_templates_domain", "ethical_templates", ["domain"], unique=True)

    op.create_table(
        "quality_analyses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "dataset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("datasets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("analysis", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("quality_score", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column(
            "column_recommendations", postgresql.JSONB(), nullable=False, server_default="{}"
        ),
        sa.Column("computed_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index(
        "ix_quality_analyses_dataset_id", "quality_analyses", ["dataset_id"], unique=True
    )


def downgrade() -> None:
    op.drop_table("quality_analyses")
    op.drop_table("ethical_templates")
    op.drop_table("dataset_columns")
    op.drop_table("dataset_files")
    op.drop_table("datasets")
