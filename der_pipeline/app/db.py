"""Database connection and setup."""

from sqlalchemy.engine import Engine
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


def get_session_sync():
    """Get synchronous database session."""
    engine = get_engine()
    return Session(engine)
