"""Main FastAPI application for UniversalDocProcessing."""

import time
import uuid
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlmodel import Session, select

from .config import settings
from .db import create_tables, get_session
from .models import Tenant

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)


def _create_default_tenant():
    """Create a default tenant for development if it doesn't exist."""
    try:
        with next(get_session()) as session:
            # Check if default tenant already exists
            existing = session.exec(select(Tenant).where(Tenant.id == 1)).first()
            if not existing:
                # Create default tenant
                default_tenant = Tenant(
                    id=1,
                    name="Default Organization",
                    slug="default",
                    api_key=None
                )
                session.add(default_tenant)
                session.commit()
                logger.info("Created default tenant (ID: 1) for development")
            else:
                logger.info("Default tenant already exists")
    except Exception as e:
        logger.warning(f"Failed to create default tenant: {e}")


# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    # Startup
    logger.info("Starting UniversalDocProcessing API")
    create_tables()
    logger.info("Database tables created/verified")
    
    # Create default tenant for development
    _create_default_tenant()

    yield

    # Shutdown
    logger.info("Shutting down UniversalDocProcessing API")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""

    app = FastAPI(
        title="UniversalDocProcessing API",
        description="5-Step Data Entry & Reconciliation Pipeline",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # Add rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Add request logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        correlation_id = str(uuid.uuid4())[:8]
        start_time = time.time()

        # Add correlation ID to request state
        request.state.correlation_id = correlation_id

        # Log request
        logger.info(
            f"[{correlation_id}] {request.method} {request.url.path} - Start",
            extra={
                "correlation_id": correlation_id,
                "method": request.method,
                "path": request.url.path,
            },
        )

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration = time.time() - start_time

        # Log response
        logger.info(
            f"[{correlation_id}] {request.method} {request.url.path} - {response.status_code} ({duration:.3f}s)",
            extra={
                "correlation_id": correlation_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration": duration,
            },
        )

        # Add correlation ID to response headers
        response.headers["X-Correlation-ID"] = correlation_id

        return response

    # Add Prometheus metrics
    instrumentator = Instrumentator()
    instrumentator.instrument(app).expose(app, endpoint="/metrics")

    # Import and include routers
    from .routers import (
        ai_health_router,
        auth_router,
        custom_pipelines_router,
        debug_router,
        document_types_router,
        fetch_router,
        finalize_router,
        hil_router,
        ingest_router,
        rag_router,
        reconcile_router,
        reports_router,
    )

    app.include_router(auth_router, prefix="/api/auth", tags=["authentication"])
    app.include_router(ingest_router, prefix="/api", tags=["ingest"])
    app.include_router(hil_router, prefix="/api", tags=["hil"])
    app.include_router(fetch_router, prefix="/api", tags=["fetch"])
    app.include_router(reconcile_router, prefix="/api", tags=["reconcile"])
    app.include_router(finalize_router, prefix="/api", tags=["finalize"])
    app.include_router(reports_router, prefix="/api", tags=["reports"])
    app.include_router(ai_health_router, prefix="/api", tags=["ai-health"])
    app.include_router(rag_router, prefix="/api", tags=["rag"])
    app.include_router(debug_router, prefix="/api", tags=["debug"])
    app.include_router(document_types_router, prefix="/api", tags=["document-types"])
    app.include_router(custom_pipelines_router, prefix="/api", tags=["custom-pipelines"])

    # Add health endpoint to API prefix
    @app.get("/api/health")
    async def api_health_check():
        """API Health check endpoint."""
        return {
            "status": "healthy",
            "version": "1.0.0",
            "environment": settings.app_env,
        }

    @app.get("/")
    async def root():
        """Root endpoint."""
        return {
            "message": "UniversalDocProcessing API",
            "version": "1.0.0",
            "docs": "/docs",
            "health": "/api/health",
        }

    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy"}

    return app


# Create the app instance
app = create_app()


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.app_env == "dev",
        log_level="info",
    )
