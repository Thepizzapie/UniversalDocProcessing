"""Database connection and setup."""

from sqlmodel import Session, create_engine
from sqlalchemy.engine import Engine

from .config import settings


def get_engine() -> Engine:
    """Get SQLAlchemy engine with connection pooling."""
    return create_engine(
        settings.database_url,
        echo=settings.debug,
        connect_args=(
            {"check_same_thread": False} if "sqlite" in settings.database_url else {}
        ),
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
