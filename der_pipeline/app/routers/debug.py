"""AI debugging API routes."""

from fastapi import APIRouter, HTTPException, status

from ..schemas import DebugRequest, DebugResponse
from ..services.debug_service import debug_service

router = APIRouter(prefix="/api/debug", tags=["debug"])


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
