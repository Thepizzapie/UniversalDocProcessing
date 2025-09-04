"""Database connection and setup."""

from sqlalchemy.engine import Engine
from sqlalchemy import inspect, text
from sqlmodel import Session, create_engine

from .config import settings


def get_engine() -> Engine:
    """Get SQLAlchemy engine with connection pooling."""
    # Use PostgreSQL if available, otherwise SQLite
    database_url = settings.postgres_url if settings.postgres_url else settings.database_url

    connect_args = {}
    if "sqlite" in database_url:
        connect_args = {"check_same_thread": False}

    return create_engine(
        database_url,
        echo=settings.debug,
        connect_args=connect_args,
    )


def get_session():
    """Get database session as context manager."""
    engine = get_engine()
    with Session(engine) as session:
        yield session


def create_tables():
    """Create all database tables."""
    from .models import SQLModel

    engine = get_engine()
    SQLModel.metadata.create_all(engine)
    _post_create_migrations(engine)


def _column_exists(engine: Engine, table: str, column: str) -> bool:
    inspector = inspect(engine)
    try:
        cols = inspector.get_columns(table)
        return any(c["name"] == column for c in cols)
    except Exception:
        return False


def _post_create_migrations(engine: Engine) -> None:
    """Lightweight, dev-safe schema adjustments for existing DBs."""
    with engine.begin() as conn:
        # Add tenant_id to document if missing
        if _column_exists(engine, "document", "id") and not _column_exists(engine, "document", "tenant_id"):
            conn.execute(text("ALTER TABLE document ADD COLUMN tenant_id INTEGER"))
        # Add tenant_id to fetchjob if missing
        if _column_exists(engine, "fetchjob", "id") and not _column_exists(engine, "fetchjob", "tenant_id"):
            conn.execute(text("ALTER TABLE fetchjob ADD COLUMN tenant_id INTEGER"))


def get_session_sync():
    """Get synchronous database session."""
    engine = get_engine()
    return Session(engine)
