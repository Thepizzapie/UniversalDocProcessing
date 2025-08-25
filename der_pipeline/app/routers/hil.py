"""HIL router - Step 2 of the pipeline."""

from fastapi import APIRouter, HTTPException

from ..db import get_session_sync
from ..models import Document
from ..schemas import HilResponse, HilUpdateRequest, HilUpdateResponse
from ..enums import PipelineState
from ..services.hil_service import HilService, apply_document_corrections


router = APIRouter()


@router.get("/hil/{document_id}", response_model=HilResponse)
async def get_hil_data(document_id: int):
    """Get current HIL data for a document."""

    # Check if document exists and is in correct state
    with get_session_sync() as session:
        document = session.get(Document, document_id)
        if not document:
            raise HTTPException(
                status_code=404, detail=f"Document {document_id} not found"
            )

        if document.state not in (
            PipelineState.HIL_REQUIRED,
            PipelineState.HIL_CONFIRMED,
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Document {document_id} is not in HIL phase (current state: {document.state.value})",
            )

    # Get HIL data
    correction_data = HilService.get_correction_data(document_id)

    if not correction_data:
        raise HTTPException(status_code=404, detail="No HIL data found")

    # Prepare response
    extracted = None
    if correction_data["extraction"]:
        extracted = {
            k: {
                "value": v["value"],
                "confidence": v["confidence"],
                "type_hint": v["type_hint"],
            }
            for k, v in correction_data["extraction"].raw_json.items()
        }

    corrected = None
    if correction_data["correction"]:
        corrected = {
            k: {
                "value": v["value"],
                "confidence": v["confidence"],
                "type_hint": v["type_hint"],
                "correction_reason": v.get("correction_reason"),
            }
            for k, v in correction_data["correction"].corrected_json.items()
        }

    return HilResponse(
        document_id=document_id,
        current_state=document.state,
        extracted=extracted,
        corrected=corrected,
    )


@router.post("/hil/{document_id}", response_model=HilUpdateResponse)
async def update_hil_corrections(document_id: int, request: HilUpdateRequest):
    """Apply human corrections to a document."""

    try:
        # Apply corrections
        correction = apply_document_corrections(
            document_id=document_id,
            corrections=request.corrections,
            reviewer=request.reviewer,
            notes=request.notes,
        )

        return HilUpdateResponse(
            document_id=document_id,
            state=PipelineState.HIL_CONFIRMED,
            corrections_applied=len(request.corrections.__root__),
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"HIL update failed: {str(e)}")
