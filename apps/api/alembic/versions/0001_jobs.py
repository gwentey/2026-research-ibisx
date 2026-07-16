"""Table jobs (supervision des travaux asynchrones) — socle J0.

Revision ID: 0001
Revises:
Create Date: 2026-07-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

job_kind = postgresql.ENUM(
    "training", "explanation", "chat", "import", "guide", "maintenance", name="job_kind"
)
job_status = postgresql.ENUM(
    "pending", "running", "completed", "failed", "cancelled", name="job_status"
)


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("kind", job_kind, nullable=False),
        sa.Column("status", job_status, nullable=False, server_default="pending"),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ref_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("queue", sa.String(32), nullable=False, server_default="maintenance"),
        sa.Column("progress", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("error_code", sa.String(64), nullable=True),
        sa.Column("message", sa.String(512), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_jobs_status", "jobs", ["status"])
    op.create_index("ix_jobs_user_id", "jobs", ["user_id"])
    op.create_index("ix_jobs_ref_id", "jobs", ["ref_id"])


def downgrade() -> None:
    op.drop_table("jobs")
    job_status.drop(op.get_bind(), checkfirst=True)
    job_kind.drop(op.get_bind(), checkfirst=True)
