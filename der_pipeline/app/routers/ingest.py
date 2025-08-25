"""Ingest router - Step 1 of the pipeline."""

import base64
from fastapi import APIRouter, HTTPException, UploadFile, File

from ..db import get_session_sync
from ..models import Document
from ..schemas import IngestRequest, IngestResponse
from ..enums import PipelineState
from ..services.extraction import extract_document_fields


router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(request: IngestRequest):
    """Ingest a new document for processing."""

    # Validate input - allow empty content for testing
    if not request.content and not request.url and request.content != "":
        raise HTTPException(
            status_code=400, detail="Either 'content' or 'url' must be provided"
        )

    # Create document record
    document = Document(
        filename=request.filename,
        mime_type=request.mime_type,
        document_type=request.document_type,
        source_uri=request.url,
        content=request.content  # ADD THE CONTENT!
    )
    
    print(f"DEBUG: Creating document with content length: {len(request.content) if request.content else 'None'}")
    print(f"DEBUG: Document type: {request.document_type}")
    print(f"DEBUG: Content preview: {request.content[:100] if request.content else 'No content'}...")

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
async def ingest_uploaded_file(
    file: UploadFile = File(...), mime_type: str | None = None
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
    if mime_type and ('text' in mime_type.lower() or 'json' in mime_type.lower()):
        try:
            actual_content = content.decode('utf-8')
            print(f"DEBUG: Decoded text content, length: {len(actual_content)}")
        except:
            actual_content = content_b64
            print(f"DEBUG: Failed to decode as text, using base64")
    elif mime_type and ('image' in mime_type.lower()):
        print(f"DEBUG: Image file detected, keeping as base64 for vision API")
        actual_content = content_b64
    
    return await ingest_document(IngestRequest(
        filename=file.filename,
        mime_type=mime_type,
        content=actual_content
    ))
