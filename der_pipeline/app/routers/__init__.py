
from .ai_health import router as ai_health_router
from .auth import router as auth_router
from .custom_pipelines import router as custom_pipelines_router
from .debug import router as debug_router
from .document_types import router as document_types_router
from .fetch import router as fetch_router
from .finalize import router as finalize_router
from .hil import router as hil_router
from .ingest import router as ingest_router
from .rag import router as rag_router
from .reconcile import router as reconcile_router
from .reports import router as reports_router

__all__ = [
    "ai_health_router",
    "auth_router",
    "custom_pipelines_router",
    "debug_router",
    "document_types_router",
    "ingest_router",
    "hil_router",
    "fetch_router",
    "reconcile_router",
    "finalize_router",
    "reports_router",
    "rag_router",
]
