"""
FastAPI service exposing AI-only document classification and extraction endpoints.

Endpoints:

1) GET /health - Health check endpoint
2) GET /metrics - Service metrics and statistics
3) POST /classify-extract
   - Accepts one uploaded file (multipart) or a file URL
   - Runs the AI pipeline and returns JSON with "classification" and "data"
   - Optional "callback_url" for async processing

4) POST /classify-extract-batch
   - Accepts multiple uploaded files under the "files" field
   - Processes documents concurrently and returns an array of results

Parameters (form fields):
 - file / files: The uploaded document(s)
 - file_url: URL to a document (single)
 - callback_url: If provided (single-doc endpoint), returns 202 and POSTs results later
 - doc_type: Optional string to force a specific document type
 - use_agents: Optional boolean; default true
 - refine: Optional boolean; default true
 - ocr_fallback: Ignored in AI-only mode (accepted for backward compatibility)

The service is stateless and does not persist any documents.
"""

from __future__ import annotations

import asyncio
import logging
import socket
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from ipaddress import ip_address, ip_network
from typing import Optional
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse

# Load environment variables first
load_dotenv()

from document_processing.config import get_config, validate_config  # noqa: E402
from document_processing.doc_classifier import (
    DocumentType,
    get_instructions_for_type,
)  # noqa: E402
from document_processing.pipeline import run_pipeline  # noqa: E402

# Configure basic logging
logger = logging.getLogger("doc_ai_service")
logging.basicConfig(level=logging.INFO)

# Get configuration instance
config = get_config()

# Concurrency limiter
_processing_semaphore = asyncio.Semaphore(config.max_concurrency)

# Simple in-memory rate limiter (per client IP)
_requests_by_ip: dict[str, deque[float]] = defaultdict(deque)

# Service metrics
_service_metrics = {
    "start_time": datetime.now(timezone.utc).isoformat(),
    "total_requests": 0,
    "successful_requests": 0,
    "failed_requests": 0,
    "total_processing_time_ms": 0,
    "documents_processed": 0,
    "document_types_processed": defaultdict(int),
    "average_processing_time_ms": 0,
}

# Optional distributed rate limiter (Redis)
_redis = None
if config.redis_url:
    try:
        import redis.asyncio as redis  # type: ignore

        _redis = redis.from_url(config.redis_url, encoding="utf-8", decode_responses=True)
        logger.info("Using Redis for rate limiting")
    except Exception as e:
        logger.warning("Failed to initialize Redis rate limiter: %s", e)
        _redis = None


def _now() -> float:
    return time.time()


async def _rate_limit_check(client_ip: str) -> None:
    window_seconds = 60
    if _redis:
        key = f"rate:{client_ip}:{int(_now() // window_seconds)}"
        try:
            count = await _redis.incr(key)
            if count == 1:
                await _redis.expire(key, window_seconds)
            if count > config.rate_limit_per_min:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded"
                )
            return
        except Exception as e:
            logger.warning("Redis rate limit check failed, falling back to in-memory: %s", e)

    timestamps = _requests_by_ip[client_ip]
    cutoff = _now() - window_seconds
    while timestamps and timestamps[0] < cutoff:
        timestamps.popleft()
    if len(timestamps) >= config.rate_limit_per_min:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded"
        )
    timestamps.append(_now())


def _is_private_ip_addr(hostname: str) -> bool:
    try:
        infos = socket.getaddrinfo(hostname, None)
        for family, _, _, _, sockaddr in infos:
            if family == socket.AF_INET:
                addr = ip_address(sockaddr[0])
            elif family == socket.AF_INET6:
                addr = ip_address(sockaddr[0])
            else:
                continue
            if any(
                addr in ip_network(net)
                for net in [
                    "10.0.0.0/8",
                    "172.16.0.0/12",
                    "192.168.0.0/16",
                    "127.0.0.0/8",
                    "::1/128",
                    "fc00::/7",
                    "fe80::/10",
                ]
            ):
                return True
    except Exception:
        # If resolution fails, treat as risky
        return True
    return False


def _validate_external_url(value: str, field_name: str) -> None:
    try:
        parsed = urlparse(value)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {field_name}")
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field_name} must use http/https"
        )
    if not parsed.hostname or _is_private_ip_addr(parsed.hostname):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} points to a private or invalid host",
        )


def _validate_upload(file: UploadFile, file_bytes: bytes) -> None:
    if len(file_bytes) > config.max_file_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large"
        )
    # Allow common images and PDFs; other types can be attempted but are unsupported
    allowed_suffixes = {
        ".pdf",
        ".png",
        ".jpg",
        ".jpeg",
        ".tif",
        ".tiff",
        ".bmp",
        ".gif",
        ".webp",
        ".heic",
        ".heif",
    }
    filename = file.filename or ""
    if filename and not any(filename.lower().endswith(s) for s in allowed_suffixes):
        # Allow unknown suffixes but warn via header; extractor will attempt MIME sniffing
        pass
    # Accept images, PDFs, or octet-stream (some browsers)
    if file.content_type and not (
        file.content_type == "application/pdf"
        or file.content_type.startswith("image/")
        or file.content_type == "application/octet-stream"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported content type"
        )


async def _auth_and_rate_limit(
    request: Request, authorization: Optional[str] = Header(default=None)
) -> None:
    # Rate limit first
    client_ip = request.client.host if request.client else "unknown"
    await _rate_limit_check(client_ip)
    # Enforce token if configured
    if config.require_auth:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token"
            )
        token = authorization.split(" ", 1)[1].strip()
        if token not in config.allowed_tokens:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


app = FastAPI(title="Document AI Service", version="1.0.0")


# Validate configuration on startup
validate_config()


@app.get("/health")
async def health_check() -> JSONResponse:
    """Health check endpoint for monitoring and load balancers."""
    try:
        # Check OpenAI API key is configured
        if not config.openai_api_key:
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"status": "unhealthy", "reason": "OpenAI API key not configured"},
            )

        # Check Redis connection if configured
        if _redis:
            try:
                await _redis.ping()
            except Exception:
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content={"status": "unhealthy", "reason": "Redis connection failed"},
                )

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": "healthy",
                "service": "Document AI Framework",
                "version": "1.0.0",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "uptime_seconds": int(
                    (
                        datetime.now(timezone.utc)
                        - datetime.fromisoformat(_service_metrics["start_time"])
                    ).total_seconds()
                ),
            },
        )
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unhealthy", "reason": str(e)},
        )


@app.get("/metrics")
async def get_metrics() -> JSONResponse:
    """Service metrics and statistics for monitoring."""
    # Calculate average processing time
    if _service_metrics["documents_processed"] > 0:
        _service_metrics["average_processing_time_ms"] = (
            _service_metrics["total_processing_time_ms"] / _service_metrics["documents_processed"]
        )

    uptime_seconds = int(
        (
            datetime.now(timezone.utc) - datetime.fromisoformat(_service_metrics["start_time"])
        ).total_seconds()
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "service_info": {
                "name": "Document AI Framework",
                "version": "1.0.0",
                "start_time": _service_metrics["start_time"],
                "uptime_seconds": uptime_seconds,
                "config": {
                    "max_concurrency": config.max_concurrency,
                    "rate_limit_per_min": config.rate_limit_per_min,
                    "max_file_size_mb": config.max_file_size_mb,
                    "model_name": config.model_name,
                    "vision_model_name": config.vision_model_name,
                },
            },
            "request_metrics": {
                "total_requests": _service_metrics["total_requests"],
                "successful_requests": _service_metrics["successful_requests"],
                "failed_requests": _service_metrics["failed_requests"],
                "success_rate": (
                    _service_metrics["successful_requests"] / _service_metrics["total_requests"]
                    if _service_metrics["total_requests"] > 0
                    else 0
                ),
            },
            "processing_metrics": {
                "documents_processed": _service_metrics["documents_processed"],
                "total_processing_time_ms": _service_metrics["total_processing_time_ms"],
                "average_processing_time_ms": _service_metrics["average_processing_time_ms"],
                "document_types_processed": dict(_service_metrics["document_types_processed"]),
            },
            "system_metrics": {
                "active_connections": (
                    len(_processing_semaphore._waiters)
                    if hasattr(_processing_semaphore, "_waiters")
                    else 0
                ),
                "available_slots": _processing_semaphore._value,
                "redis_connected": _redis is not None,
            },
        },
    )


async def _process_and_callback(
    file_bytes: Optional[bytes],
    file_path: Optional[str],
    return_text: bool,
    callback_url: str,
    forced_doc_type: Optional[str],
    use_agents: bool,
    run_refine_pass: bool,
    ocr_fallback: bool,
    file_url: Optional[str] = None,
) -> None:
    """Background task to process a document and POST the result to a callback URL.

    Args:
        file_bytes: Binary content of the uploaded document or None if using file_path.
        file_path: Path to the document on disk or None if using file_bytes.
        return_text: Whether to include the raw OCR text in the response.
        callback_url: URL to POST the result to.
    """
    try:
        # If a file URL was provided and no bytes/path were given, download here in background
        if file_url and not file_bytes and not file_path:
            try:
                _validate_external_url(file_url, "file_url")
                async with httpx.AsyncClient() as client:
                    response = await client.get(file_url, timeout=30.0)
                    response.raise_for_status()
                    file_bytes = response.content
            except Exception as fetch_err:
                logger.exception("Background download failed: %s", fetch_err)
                file_bytes = None

        async with _processing_semaphore:
            result = await asyncio.to_thread(
                run_pipeline,
                file_bytes,
                file_path,
                bool(return_text),
                forced_doc_type,
                bool(use_agents),
                bool(run_refine_pass),
                bool(ocr_fallback),
            )
        async with httpx.AsyncClient() as client:
            await client.post(callback_url, json=result, timeout=30.0)
    except Exception as e:
        logger.exception("Error processing document in background: %s", e)


@app.post("/classify-extract")
async def classify_extract(
    _: None = Depends(_auth_and_rate_limit),
    file: Optional[UploadFile] = File(None),
    file_url: Optional[str] = Form(None),
    callback_url: Optional[str] = Form(None),
    return_text: Optional[bool] = Form(False),
    doc_type: Optional[str] = Form(None),
    use_agents: Optional[bool] = Form(True),
    refine: Optional[bool] = Form(True),
    ocr_fallback: Optional[bool] = Form(True),
) -> JSONResponse:
    """Classify and extract fields from a document.

    Accepts either an uploaded file or a URL pointing to a file.  If a
    callback URL is provided the request will be processed asynchronously
    and a 202 response returned; otherwise the response will be
    synchronous with a 200 status code.
    """
    # Track request metrics
    _service_metrics["total_requests"] += 1

    if file is None and not file_url:
        _service_metrics["failed_requests"] += 1
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="file or file_url must be provided"
        )

    # Validate optional flags
    if doc_type is not None:
        try:
            DocumentType(doc_type)
        except Exception:
            _service_metrics["failed_requests"] += 1
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid doc_type")

    file_bytes: Optional[bytes] = None
    local_path: Optional[str] = None
    # If async callback is requested, queue work without downloading remote file first
    if callback_url:
        if file is not None:
            file_bytes = await file.read()
            _validate_upload(file, file_bytes)
        elif file_url:
            if not config.allow_file_urls:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="Remote URLs are disabled"
                )
        # Trigger background processing and return 202 immediately
        loop = asyncio.get_event_loop()
        loop.create_task(
            _process_and_callback(
                file_bytes,
                local_path,
                bool(return_text),
                callback_url,
                doc_type,
                bool(use_agents),
                bool(refine),
                bool(ocr_fallback),
                file_url=file_url,
            )
        )
        return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content={"status": "queued"})

    # Synchronous path: if file_url is provided, download now
    if file_url:
        if not config.allow_file_urls:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Remote URLs are disabled"
            )
        _validate_external_url(file_url, "file_url")
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(file_url, timeout=30.0)
                response.raise_for_status()
                file_bytes = response.content
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to download file from URL: {e}",
            )
        if file_bytes and len(file_bytes) > config.max_file_size_mb * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Downloaded file too large",
            )
    elif file is not None:
        file_bytes = await file.read()
        _validate_upload(file, file_bytes)

    # Otherwise process synchronously
    try:
        start = _now()
        async with _processing_semaphore:
            result = await asyncio.to_thread(
                run_pipeline,
                file_bytes,
                local_path,
                bool(return_text),
                doc_type,
                bool(use_agents),
                bool(refine),
                bool(ocr_fallback),
            )
        duration_ms = int((_now() - start) * 1000)

        # Update metrics
        _service_metrics["successful_requests"] += 1
        _service_metrics["documents_processed"] += 1
        _service_metrics["total_processing_time_ms"] += duration_ms

        # Track document type if available
        if result.get("classification", {}).get("type"):
            doc_type_processed = result["classification"]["type"]
            _service_metrics["document_types_processed"][doc_type_processed] += 1

        logger.info(
            "processed document: use_agents=%s refine=%s bytes=%s duration_ms=%s type=%s",
            bool(use_agents),
            bool(refine),
            len(file_bytes) if file_bytes else None,
            duration_ms,
            result.get("classification", {}).get("type", "unknown"),
        )
    except Exception as e:
        _service_metrics["failed_requests"] += 1
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    return JSONResponse(status_code=status.HTTP_200_OK, content=result)


@app.post("/classify-extract-batch")
async def classify_extract_batch(
    _: None = Depends(_auth_and_rate_limit),
    files: list[UploadFile] = File(...),
    use_agents: Optional[bool] = Form(True),
    refine: Optional[bool] = Form(True),
    doc_type: Optional[str] = Form(None),
) -> JSONResponse:
    """Process multiple documents concurrently and return an array of results.

    Each element in the returned list contains the same structure as the
    single-document endpoint. Items with errors will include an "errors" field.
    """
    # Track request metrics
    _service_metrics["total_requests"] += 1

    if not files:
        _service_metrics["failed_requests"] += 1
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided")

    results: list[dict] = []

    async def _process_one(up: UploadFile) -> dict:
        file_bytes = await up.read()
        _validate_upload(up, file_bytes)
        try:
            res = await asyncio.to_thread(
                run_pipeline,
                file_bytes,
                None,
                False,
                doc_type,
                bool(use_agents),
                bool(refine),
                True,
            )
            return {"filename": up.filename, **res}
        except Exception as e:
            return {"filename": up.filename, "errors": [str(e)], "classification": {}, "data": {}}

    async with _processing_semaphore:
        results = await asyncio.gather(*[_process_one(f) for f in files])

    # Update batch metrics
    _service_metrics["successful_requests"] += 1
    _service_metrics["documents_processed"] += len(files)

    # Track document types processed in batch
    for result in results:
        if result.get("classification", {}).get("type"):
            doc_type_processed = result["classification"]["type"]
            _service_metrics["document_types_processed"][doc_type_processed] += 1

    return JSONResponse(status_code=status.HTTP_200_OK, content=results)


# --- Document Types Management (read-only) -----------------------------------

@app.get("/doc-types")
async def list_document_types(_: None = Depends(_auth_and_rate_limit)) -> JSONResponse:
    """Return the list of supported document types.

    This endpoint is read-only and meant for UI configuration screens.
    """
    types = [dt.value for dt in DocumentType]
    return JSONResponse(status_code=status.HTTP_200_OK, content={"types": types})


@app.get("/doc-types/{doc_type}")
async def get_document_type(
    doc_type: str, _: None = Depends(_auth_and_rate_limit)
) -> JSONResponse:
    """Return the extraction instructions for a given document type."""
    try:
        dt = DocumentType(doc_type)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown doc_type")
    instructions = get_instructions_for_type(dt)
    return JSONResponse(status_code=status.HTTP_200_OK, content={"doc_type": dt.value, "instructions": instructions})
