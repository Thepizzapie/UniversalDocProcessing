"""Ingest router - Step 1 of the pipeline."""

import base64

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..auth import get_current_active_user
from ..config import settings
from ..db import get_session_sync
from ..enums import PipelineState
from ..models import Document
from ..schemas import IngestRequest, IngestResponse
from ..services.extraction import extract_document_fields, ExtractionService
from ..services.pipeline_runner import PipelineRunner
from ..utils.validation import validate_document_content
from ..utils.tenant import get_tenant_id

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/ingest", response_model=IngestResponse)
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
def ingest_document(
    request: Request,
    ingest_request: IngestRequest,
    tenant_id: int = Depends(get_tenant_id),
    # current_user=Depends(get_current_active_user),  # Temporarily disabled for testing
):
    """Ingest a new document for processing."""

    # Validate input - allow empty content for testing
    if not ingest_request.content and not ingest_request.url and ingest_request.content != "":
        raise HTTPException(status_code=400, detail="Either 'content' or 'url' must be provided")

    # Content validation
    if ingest_request.content:
        if not validate_document_content(ingest_request.content, ingest_request.mime_type):
            raise HTTPException(status_code=400, detail="Invalid or unsupported document content")

    # Enforce selected type: require either a valid enum (not UNKNOWN) or a custom_doc_type_name
    from ..enums import DocumentType as _DT
    enum_doc_type = ingest_request.document_type
    if (enum_doc_type == _DT.UNKNOWN) and not ingest_request.custom_doc_type_name:
        raise HTTPException(status_code=400, detail="document_type or custom_doc_type_name is required")
    # If custom_doc_type_name provided and enum is UNKNOWN, derive enum from the name for basic bucketing
    if ingest_request.custom_doc_type_name and enum_doc_type == _DT.UNKNOWN:
        lowered = ingest_request.custom_doc_type_name.lower()
        if "receipt" in lowered or "purchase" in lowered:
            enum_doc_type = _DT.RECEIPT
        elif "invoice" in lowered:
            enum_doc_type = _DT.INVOICE
        elif any(k in lowered for k in ["entry", "exit", "log"]):
            enum_doc_type = _DT.ENTRY_EXIT_LOG
        else:
            enum_doc_type = _DT.RECEIPT  # default bucket

    # Create document record
    # If custom doc type name provided, and DocumentType is UNKNOWN, keep enum but we will force custom path later
    document = Document(
        filename=ingest_request.filename,
        mime_type=ingest_request.mime_type,
        document_type=enum_doc_type,
        source_uri=ingest_request.url,
        content=ingest_request.content,  # ADD THE CONTENT!
        tenant_id=tenant_id,
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
        # If the request specifies a custom doc type name, use the forced custom extraction path
        if ingest_request.custom_doc_type_name:
            # Run the full custom pipeline if steps exist; falls back to just forced extraction
            PipelineRunner.run_pipeline(document.id, ingest_request.custom_doc_type_name)
            # fetch latest extraction for response
            extracted_data = ExtractionService.extract_forced_custom(document, ingest_request.custom_doc_type_name)
        else:
            # Extract data from document
            extracted_data = extract_document_fields(document.id)

        # Attach extraction_mode if present (for quick diagnostics in UI)
        extracted_root = extracted_data.root
        try:
            if "_extraction_mode" in extracted_root:
                mode = extracted_root.get("_extraction_mode")
                print(f"DEBUG: extraction_mode={getattr(mode, 'value', mode)}")
        except Exception:
            pass

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
    mime_type: str | None = Form(None),
    document_type: str | None = Form(None),
    custom_doc_type_name: str | None = Form(None),
    tenant_id: int = Depends(get_tenant_id),
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

    print(f"DEBUG: Received document_type parameter: '{document_type}'")
    print(f"DEBUG: Type of document_type: {type(document_type)}")
    
    doc_type = DocumentType.UNKNOWN
    if document_type:
        try:
            doc_type = DocumentType(document_type)
            print(f"DEBUG: Successfully converted to enum: {doc_type}")
        except ValueError as e:
            print(f"DEBUG: Failed to convert '{document_type}' to DocumentType enum: {e}")
            # Try fuzzy mapping from free-text to known enums
            lowered = document_type.lower()
            if "receipt" in lowered:
                doc_type = DocumentType.RECEIPT
                print("DEBUG: Fuzzy-mapped to enum: RECEIPT")
            elif "invoice" in lowered:
                doc_type = DocumentType.INVOICE
                print("DEBUG: Fuzzy-mapped to enum: INVOICE")
            elif "entry" in lowered or "exit" in lowered or "log" in lowered:
                doc_type = DocumentType.ENTRY_EXIT_LOG
                print("DEBUG: Fuzzy-mapped to enum: ENTRY_EXIT_LOG")
            else:
                doc_type = DocumentType.UNKNOWN
                print("DEBUG: Could not fuzzy-map document_type; using UNKNOWN")
    else:
        print("DEBUG: No document_type provided, defaulting to UNKNOWN")

    return ingest_document(
        request,
        IngestRequest(
            filename=file.filename,
            mime_type=mime_type,
            content=actual_content,
            document_type=doc_type,
            custom_doc_type_name=custom_doc_type_name,
        ),
        tenant_id=tenant_id,
    )


@router.post("/re-extract/{document_id}", response_model=IngestResponse)
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
def re_extract_document(
    request: Request,
    document_id: int,
    custom_doc_type_name: str = Form(None),
    tenant_id: int = Depends(get_tenant_id),
):
    """Re-extract data from an existing document using a custom doc type."""

    # Get the existing document
    with get_session_sync() as session:
        document = session.get(Document, document_id)
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")
        if document.tenant_id != tenant_id:
            raise HTTPException(status_code=403, detail="Document belongs to different tenant")

    try:
        # If custom doc type name provided, use forced custom extraction
        if custom_doc_type_name:
            # Run the full custom pipeline if steps exist; falls back to just forced extraction
            PipelineRunner.run_pipeline(document.id, custom_doc_type_name)
            # Fetch latest extraction for response
            extracted_data = ExtractionService.extract_forced_custom(document, custom_doc_type_name)
        else:
            # Extract data from document using default method
            extracted_data = extract_document_fields(document.id)

        # Update document state
        with get_session_sync() as session:
            doc = session.get(Document, document.id)
            if doc:
                doc.state = PipelineState.HIL_REQUIRED
                session.commit()

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

        raise HTTPException(status_code=500, detail=f"Re-extraction failed: {str(e)}")
