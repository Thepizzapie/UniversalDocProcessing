"""Fetch router - Step 3 of the pipeline."""

from fastapi import APIRouter, HTTPException, BackgroundTasks

from ..db import get_session_sync
from ..models import Document
from ..schemas import FetchRequest, FetchResponse
from ..enums import PipelineState
from ..services.fetch_service import fetch_comparator_data


router = APIRouter()


@router.post("/fetch/{document_id}", response_model=FetchResponse)
async def fetch_comparator_data_endpoint(
    document_id: int, request: FetchRequest, background_tasks: BackgroundTasks
):
    """Fetch comparator data from external sources."""

    # Check if document exists and is ready for fetching
    with get_session_sync() as session:
        document = session.get(Document, document_id)
        if not document:
            raise HTTPException(
                status_code=404, detail=f"Document {document_id} not found"
            )

        if document.state not in (
            PipelineState.HIL_CONFIRMED,
            PipelineState.FETCH_PENDING,
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Document {document_id} is not ready for fetching (current state: {document.state.value})",
            )

    # Default targets if none provided
    targets = request.targets or ["example_vendor"]

    try:
        # Run fetch in background for async processing
        background_tasks.add_task(fetch_comparator_data, document_id, targets)

        return FetchResponse(
            document_id=document_id,
            state=PipelineState.FETCH_PENDING,
            fetch_job_id=0,  # Will be set by service
            targets_processed=targets,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fetch failed: {str(e)}")


@router.get("/fetch/{document_id}/status")
async def get_fetch_status(document_id: int):
    """Get current fetch status for a document."""

    with get_session_sync() as session:
        document = session.get(Document, document_id)
        if not document:
            raise HTTPException(
                status_code=404, detail=f"Document {document_id} not found"
            )

        return {
            "document_id": document_id,
            "state": document.state.value,
            "fetch_jobs": [
                {
                    "id": job.id,
                    "status": job.status.value,
                    "targets": job.targets,
                    "created_at": job.created_at.isoformat(),
                }
                for job in document.fetch_jobs
            ],
        }
