"""Engine et sessions SQLAlchemy (sync, psycopg 3)."""

from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from ibis.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    # Charge tous les modèles avant la première session (résolution des FK inter-modules)
    import ibis.db.registry  # noqa: F401

    return create_engine(get_settings().database_url, pool_pre_ping=True, pool_size=5)


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """Dépendance FastAPI : une session par requête."""
    session = get_sessionmaker()()
    try:
        yield session
    finally:
        session.close()


def open_session() -> Session:
    """Session hors requête (worker Celery, CLI) — à fermer par l'appelant."""
    return get_sessionmaker()()
