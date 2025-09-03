"""Finalize router - Step 5 of the pipeline."""

from fastapi import APIRouter, HTTPException, Depends

from ..db import get_session_sync
from ..enums import Decision, PipelineState
from ..models import Document
from ..schemas import FinalizeRequest, FinalizeResponse
from ..services.finalize_service import FinalizeService, finalize_document_processing
from ..auth import get_current_active_user, requires_role
from ..utils.validation import validate_extracted_fields

router = APIRouter()


@router.post("/finalize/{document_id}")
@requires_role("reviewer", "admin")
async def finalize_document(document_id: int, request: FinalizeRequest, current_user=Depends(get_current_active_user)):
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

    # Do not hard-block on state here; FinalizeService will decide based on pipeline config

    try:
        # Optional: perform a lightweight business validation before finalize
        from ..models import Extraction
        with get_session_sync() as session:
            extraction = (
                session.query(Extraction)
                .filter(Extraction.document_id == document_id)
                .order_by(Extraction.id.desc())
                .first()
            )
            if extraction and isinstance(extraction.raw_json, dict):
                fields = extraction.raw_json.get("instructed_fields") or extraction.raw_json
                # Flatten {k: {value, confidence}} to {k: value}
                flat = {k: (v.get("value") if isinstance(v, dict) else v) for k, v in fields.items()}
                errors = validate_extracted_fields(flat)
                if errors and request.decision == Decision.APPROVED:
                    raise HTTPException(status_code=400, detail={"validation_errors": errors})

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
        # If auth dependency fails earlier we won't reach here, but keep message generic otherwise
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
