"""
FastAPI service exposing a document classification and extraction endpoint.

The service provides a ``POST /classify-extract`` endpoint which accepts
either an uploaded file (multipart form) or a URL pointing to the file.
It orchestrates the document processing pipeline defined in
``document_processing.pipeline`` and returns a JSON response containing
the document type and extracted fields.  Optionally a callback URL can
be provided for asynchronous processing; the service will return a 202
Accepted response immediately and POST the results to the callback URL
when ready.

The API expects the following form fields:

* ``file``: The uploaded document (optional if ``file_url`` is provided).
* ``file_url``: A URL pointing to the document (optional if ``file`` is provided).
* ``callback_url``: If provided, the service processes the document in the
  background and POSTs the result to this URL instead of returning it
  synchronously.
* ``return_text``: Optional boolean; if ``true`` includes the raw OCR
  text in the response.
* ``doc_type``: Optional string to force a specific document type (single-doc-mode).
* ``use_agents``: Optional boolean; default true. If false, use LangChain-only path.
* ``refine``: Optional boolean; default true. If false, skip refinement pass.
* ``ocr_fallback``: Optional boolean; default true. If false, do not fallback to raw text.

The service is stateless and does not persist any documents.  All
processing happens in memory or on disk temporarily.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, status
from fastapi.responses import JSONResponse

from ..document_processing.pipeline import run_pipeline
from dotenv import load_dotenv

# Configure basic logging
logger = logging.getLogger("doc_ai_service")
logging.basicConfig(level=logging.INFO)


load_dotenv()
app = FastAPI(title="Document AI Service", version="1.0.0")


async def _process_and_callback(
    file_bytes: Optional[bytes],
    file_path: Optional[str],
    return_text: bool,
    callback_url: str,
    forced_doc_type: Optional[str],
    use_agents: bool,
    run_refine_pass: bool,
    ocr_fallback: bool,
) -> None:
    """Background task to process a document and POST the result to a callback URL.

    Args:
        file_bytes: Binary content of the uploaded document or None if using file_path.
        file_path: Path to the document on disk or None if using file_bytes.
        return_text: Whether to include the raw OCR text in the response.
        callback_url: URL to POST the result to.
    """
    try:
        result = run_pipeline(
            file=file_bytes,
            file_path=file_path,
            return_text=return_text,
            forced_doc_type=forced_doc_type,
            use_agents=use_agents,
            run_refine_pass=run_refine_pass,
            ocr_fallback=ocr_fallback,
        )
        async with httpx.AsyncClient() as client:
            await client.post(callback_url, json=result)
    except Exception as e:
        logger.exception("Error processing document in background: %s", e)


@app.post("/classify-extract")
async def classify_extract(
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
    if file is None and not file_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="file or file_url must be provided")

    # Download file if file_url is provided
    file_bytes: Optional[bytes] = None
    local_path: Optional[str] = None
    if file_url:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(file_url)
                response.raise_for_status()
                file_bytes = response.content
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to download file from URL: {e}",
            )
    elif file is not None:
        file_bytes = await file.read()

    # If callback is provided process asynchronously
    if callback_url:
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
            )
        )
        return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content={"status": "queued"})

    # Otherwise process synchronously
    try:
        result = run_pipeline(
            file=file_bytes,
            file_path=local_path,
            return_text=bool(return_text),
            forced_doc_type=doc_type,
            use_agents=bool(use_agents),
            run_refine_pass=bool(refine),
            ocr_fallback=bool(ocr_fallback),
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    return JSONResponse(status_code=status.HTTP_200_OK, content=result)