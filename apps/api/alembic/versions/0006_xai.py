"""XAI M6 : explanations, chat_sessions, chat_messages (CDC §9, ARCH §6.2).

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

explanation_type = postgresql.ENUM("global", "local", name="explanation_type")
explanation_status = postgresql.ENUM(
    "pending", "running", "completed", "failed", name="explanation_status"
)


def upgrade() -> None:
    op.create_table(
        "explanations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "experiment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("experiments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", explanation_type, nullable=False),
        sa.Column("method_requested", sa.String(20), nullable=False, server_default="auto"),
        sa.Column("method_used", sa.String(30), nullable=True),
        sa.Column("method_justification", sa.String(255), nullable=True),
        sa.Column("audience_level", sa.String(20), nullable=False, server_default="novice"),
        sa.Column("language", sa.String(5), nullable=False, server_default="fr"),
        sa.Column("instance_ref", postgresql.JSONB(), nullable=True),
        sa.Column("status", explanation_status, nullable=False, server_default="pending"),
        sa.Column("progress", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("error_code", sa.String(64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("values", postgresql.JSONB(), nullable=True),
        sa.Column("quality_kpis", postgresql.JSONB(), nullable=True),
        sa.Column("viz_data", postgresql.JSONB(), nullable=True),
        sa.Column("text_explanation", sa.Text(), nullable=True),
        sa.Column("model_used", sa.String(120), nullable=True),
        sa.Column("is_fallback", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("tokens_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processing_seconds", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_explanations_user_id", "explanations", ["user_id"])
    op.create_index("ix_explanations_experiment_id", "explanations", ["experiment_id"])
    op.create_index("ix_explanations_status", "explanations", ["status"])

    op.create_table(
        "chat_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "explanation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("explanations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("language", sa.String(5), nullable=False, server_default="fr"),
        sa.Column("questions_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_questions", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_activity", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_chat_sessions_explanation_id", "chat_sessions", ["explanation_id"])
    op.create_index("ix_chat_sessions_user_id", "chat_sessions", ["user_id"])

    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chat_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("model_used", sa.String(120), nullable=True),
        sa.Column("is_fallback", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("tokens_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("response_seconds", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_chat_messages_session_id", "chat_messages", ["session_id"])


def downgrade() -> None:
    op.drop_table("chat_messages")
    op.drop_table("chat_sessions")
    op.drop_table("explanations")
    explanation_status.drop(op.get_bind(), checkfirst=True)
    explanation_type.drop(op.get_bind(), checkfirst=True)
