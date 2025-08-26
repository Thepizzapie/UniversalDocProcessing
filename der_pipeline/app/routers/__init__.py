"""API routers for the document processing pipeline."""

from .fetch import router as fetch_router
from .finalize import router as finalize_router
from .hil import router as hil_router
from .ingest import router as ingest_router
from .reconcile import router as reconcile_router
from .reports import router as reports_router

__all__ = [
    "ingest_router",
    "hil_router",
    "fetch_router",
    "reconcile_router",
    "finalize_router",
    "reports_router",
]
