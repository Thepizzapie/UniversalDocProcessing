"""Ingest router - Step 1 of the pipeline."""

import base64

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..auth import get_current_active_user
from ..config import settings
from ..db import get_session_sync
from ..enums import PipelineState
from ..models import Document
from ..schemas import IngestRequest, IngestResponse
from ..services.extraction import extract_document_fields

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/ingest", response_model=IngestResponse)
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
def ingest_document(
    request: Request,
    ingest_request: IngestRequest,
    # current_user=Depends(get_current_active_user),  # Temporarily disabled for testing
):
    """Ingest a new document for processing."""

    # Validate input - allow empty content for testing
    if not ingest_request.content and not ingest_request.url and ingest_request.content != "":
        raise HTTPException(status_code=400, detail="Either 'content' or 'url' must be provided")

    # Create document record
    document = Document(
        filename=ingest_request.filename,
        mime_type=ingest_request.mime_type,
        document_type=ingest_request.document_type,
        source_uri=ingest_request.url,
        content=ingest_request.content,  # ADD THE CONTENT!
    )

    print(
        f"DEBUG: Creating document with content length: {len(ingest_request.content) if ingest_request.content else 'None'}"
    )
    print(f"DEBUG: Document type: {ingest_request.document_type}")
    print(
        f"DEBUG: Content preview: {ingest_request.content[:100] if ingest_request.content else 'No content'}..."
    )

    with get_session_sync() as session:
        session.add(document)
        session.commit()
        session.refresh(document)

    try:
        # Extract data from document
        extracted_data = extract_document_fields(document.id)

        return IngestResponse(
            document_id=document.id,
            state=PipelineState.HIL_REQUIRED,
            extracted=extracted_data.root,
        )

    except Exception as e:
        # Update document state to failed
        with get_session_sync() as session:
            doc = session.get(Document, document.id)
            if doc:
                doc.state = PipelineState.FAILED
                session.commit()

        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.post("/ingest/upload", response_model=IngestResponse)
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
async def ingest_uploaded_file(
    request: Request,
    file: UploadFile = File(...),
    mime_type: str | None = None,
    document_type: str | None = None,
    # current_user=Depends(get_current_active_user),  # Temporarily disabled for testing
):
    """Ingest a document via file upload."""

    # Read file content
    content = await file.read()

    # Use base64 encoding for storage
    content_b64 = base64.b64encode(content).decode("utf-8")

    # Determine mime type
    if not mime_type:
        mime_type = file.content_type or "application/octet-stream"

    # For text files, decode to text. For images, keep as base64 for vision API
    actual_content = content_b64
    if mime_type and ("text" in mime_type.lower() or "json" in mime_type.lower()):
        try:
            actual_content = content.decode("utf-8")
            print(f"DEBUG: Decoded text content, length: {len(actual_content)}")
        except UnicodeDecodeError:
            actual_content = content_b64
            print("DEBUG: Failed to decode as text, using base64")
    elif mime_type and ("image" in mime_type.lower()):
        print("DEBUG: Image file detected, keeping as base64 for vision API")
        actual_content = content_b64

    # Convert document_type string to enum
    from ..enums import DocumentType
    doc_type = DocumentType.UNKNOWN
    if document_type:
        try:
            doc_type = DocumentType(document_type)
        except ValueError:
            doc_type = DocumentType.UNKNOWN
    
    return ingest_document(
        request,
        IngestRequest(
            filename=file.filename, 
            mime_type=mime_type, 
            content=actual_content,
            document_type=doc_type
        )
    )
