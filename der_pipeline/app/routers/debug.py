"""AI debugging API routes."""

from fastapi import APIRouter, HTTPException, status

from ..schemas import (
    DebugRequest,
    DebugResponse,
    DebugRunRequest,
    DebugRunResponse,
)
from ..services.debug_service import debug_service
from ..services.crewai_service import crewai_service
from ..db import get_session_sync
from ..models import Document

router = APIRouter(prefix="/debug", tags=["debug"])


@router.post("/extraction/{document_id}", response_model=DebugResponse)
async def debug_extraction(document_id: int, request: DebugRequest):
    """Debug extraction stage issues for a document."""
    try:
        request.stage = "extraction"
        return debug_service.analyze_extraction_issues(document_id, request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to debug extraction: {str(e)}",
        )


@router.post("/reconciliation/{document_id}", response_model=DebugResponse)
async def debug_reconciliation(document_id: int, request: DebugRequest):
    """Debug reconciliation stage issues for a document."""
    try:
        request.stage = "reconciliation"
        return debug_service.analyze_reconciliation_issues(document_id, request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to debug reconciliation: {str(e)}",
        )


@router.post("/hil/{document_id}", response_model=DebugResponse)
async def debug_hil_feedback(document_id: int, request: DebugRequest):
    """Analyze HIL corrections to improve future extractions."""
    try:
        request.stage = "hil"
        return debug_service.analyze_hil_feedback(document_id, request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to debug HIL feedback: {str(e)}",
        )


@router.post("/performance/{document_id}", response_model=DebugResponse)
async def debug_pipeline_performance(document_id: int, request: DebugRequest):
    """Analyze overall pipeline performance for a document."""
    try:
        request.stage = "performance"
        return debug_service.analyze_pipeline_performance(document_id, request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to debug performance: {str(e)}",
        )


@router.get("/history/{document_id}", response_model=list[DebugResponse])
async def get_debug_history(document_id: int):
    """Get debug analysis history for a document."""
    try:
        return debug_service.get_debug_history(document_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get debug history: {str(e)}",
        )


@router.post("/dry-run/{document_id}", response_model=DebugRunResponse)
async def dry_run_extraction(document_id: int, request: DebugRunRequest):
    """Run a dry extraction using CrewAI without changing DB state.

    - Optionally override document type
    - Optionally provide sample text instead of stored content
    """
    try:
        with get_session_sync() as session:
            document = session.get(Document, document_id)
            if not document:
                raise HTTPException(status_code=404, detail="Document not found")

            doc_type = request.document_type_override or (
                document.document_type.value
                if hasattr(document.document_type, "value")
                else str(document.document_type)
            )

            content = request.sample_text or (document.content or "")
            result = crewai_service.extract_document_data(content, doc_type)

            if result is None:
                return DebugRunResponse(
                    used_document_type=doc_type,
                    fields={},
                    prompt_chars=None,
                    content_chars=len(content) if content else 0,
                    notes="CrewAI disabled or unavailable",
                )

            return DebugRunResponse(
                used_document_type=doc_type,
                fields=result.root,
                prompt_chars=None,
                content_chars=len(content) if content else 0,
                notes="Dry-run completed",
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dry-run failed: {str(e)}",
        )
