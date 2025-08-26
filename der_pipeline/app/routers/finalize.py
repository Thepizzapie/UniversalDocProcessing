"""Finalize router - Step 5 of the pipeline."""

from fastapi import APIRouter, HTTPException

from ..db import get_session_sync
from ..enums import Decision, PipelineState
from ..models import Document
from ..schemas import FinalizeRequest, FinalizeResponse
from ..services.finalize_service import FinalizeService, finalize_document_processing

router = APIRouter()


@router.post("/finalize/{document_id}", response_model=FinalizeResponse)
async def finalize_document(document_id: int, request: FinalizeRequest):
    """Finalize document processing with approval or rejection."""

    # Check if document can be finalized
    if not FinalizeService.can_modify_document(document_id):
        raise HTTPException(
            status_code=409, detail=f"Document {document_id} has already been finalized"
        )

    with get_session_sync() as session:
        document = session.get(Document, document_id)
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")

        if document.state != PipelineState.RECONCILED:
            raise HTTPException(
                status_code=400,
                detail=f"Document {document_id} is not ready for finalization (current state: {document.state.value})",
            )

    try:
        # Finalize the document
        final_decision = finalize_document_processing(
            document_id=document_id,
            decision=request.decision,
            decider=request.decider,
            notes=request.notes,
        )

        return FinalizeResponse(
            document_id=document_id,
            state=(
                PipelineState.APPROVED
                if request.decision == Decision.APPROVED
                else PipelineState.REJECTED
            ),
            decision=request.decision,
            finalized_at=final_decision.timestamp,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Finalization failed: {str(e)}")


@router.get("/finalize/{document_id}/decision")
async def get_final_decision(document_id: int):
    """Get final decision for a document."""

    final_decision = FinalizeService.get_final_decision(document_id)

    if not final_decision:
        raise HTTPException(status_code=404, detail="No final decision found")

    return {
        "document_id": document_id,
        "decision": final_decision.decision.value,
        "decider": final_decision.decider,
        "notes": final_decision.notes,
        "timestamp": final_decision.timestamp.isoformat(),
    }
