"""Environnement Alembic — chaîne de migrations UNIQUE (ADR-002).

Un verrou advisory PostgreSQL sérialise les `upgrade head` concurrents
(api et worker démarrant en même temps — ARCH §6.1).
"""

from sqlalchemy import create_engine, text

# Importe tous les modèles pour peupler Base.metadata (autogenerate + create_all tests)
import ibis.modules.jobs.models  # noqa: F401
from alembic import context
from ibis.core.config import get_settings
from ibis.db.base import Base

target_metadata = Base.metadata

ADVISORY_LOCK_KEY = 761850  # arbitraire, stable


def run_migrations_offline() -> None:
    context.configure(
        url=get_settings().database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(get_settings().database_url, pool_pre_ping=True)
    with engine.connect() as connection:
        connection.execute(text("SELECT pg_advisory_lock(:key)"), {"key": ADVISORY_LOCK_KEY})
        try:
            context.configure(
                connection=connection, target_metadata=target_metadata, compare_type=True
            )
            with context.begin_transaction():
                context.run_migrations()
        finally:
            connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": ADVISORY_LOCK_KEY})
            connection.commit()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
