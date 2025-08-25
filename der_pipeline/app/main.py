"""Main FastAPI application for UniversalDocProcessing."""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import create_tables
from app.routers import ingest_router, hil_router, fetch_router, reconcile_router, finalize_router, reports_router
from app.routers.ai_health import router as ai_health_router
from app.routers.rag import router as rag_router
from app.routers.debug import router as debug_router
from app.routers.document_types import router as document_types_router
from app.routers.config import router as config_router


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""

    app = FastAPI(
        title="UniversalDocProcessing API",
        description="5-Step Data Entry & Reconciliation Pipeline",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(ingest_router, prefix="/api", tags=["ingest"])
    app.include_router(hil_router, prefix="/api", tags=["hil"])
    app.include_router(fetch_router, prefix="/api", tags=["fetch"])
    app.include_router(reconcile_router, prefix="/api", tags=["reconcile"])
    app.include_router(finalize_router, prefix="/api", tags=["finalize"])
    app.include_router(reports_router, prefix="/api", tags=["reports"])
    app.include_router(ai_health_router, prefix="/api", tags=["ai-health"])
    app.include_router(rag_router, tags=["rag"])
    app.include_router(debug_router, tags=["debug"])
    app.include_router(document_types_router, tags=["document-types"])
    app.include_router(config_router, prefix="/api", tags=["config"])

    # Add health endpoint to API prefix
    @app.get("/api/health")
    async def api_health_check():
        """API Health check endpoint."""
        return {"status": "healthy"}

    # Static files for HIL UI (if implemented)
    try:
        app.mount("/static", StaticFiles(directory="web/hil_ui"), name="static")
    except RuntimeError:
        # Directory doesn't exist, skip mounting
        pass

    @app.on_event("startup")
    async def startup_event():
        """Initialize database tables on startup."""
        create_tables()

    @app.get("/")
    async def root():
        """Root endpoint."""
        return {"message": "UniversalDocProcessing API", "version": "1.0.0"}

    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy"}

    return app


# Create the app instance
app = create_app()


if __name__ == "__main__":
    from .config import settings
    uvicorn.run(
        "app.main:app", host=settings.host, port=settings.port, reload=False, log_level="info"
    )
