"""HIL router - Step 2 of the pipeline."""

from fastapi import APIRouter, Depends, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..auth import get_current_active_user, requires_role
from ..db import get_session_sync
from ..enums import PipelineState
from ..models import Document
from ..schemas import HilResponse, HilUpdateRequest, HilUpdateResponse
from ..services.hil_service import HilService, apply_document_corrections

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.get("/hil/{document_id}", response_model=HilResponse)
async def get_hil_data(
    document_id: int,
    current_user=Depends(get_current_active_user),
):
    """Get current HIL data for a document."""

    # Check if document exists and is in correct state
    with get_session_sync() as session:
        document = session.get(Document, document_id)
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")

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
    extracted_full = None
    if correction_data["extraction"]:
        raw_json = correction_data["extraction"].raw_json or {}
        # Support new structured payload with instructed_fields + all_fields
        instructed = raw_json.get("instructed_fields")
        all_fields = raw_json.get("all_fields")
        source_for_extracted = instructed if isinstance(instructed, dict) else raw_json
        source_for_full = all_fields if isinstance(all_fields, dict) else raw_json

        extracted = {
            k: {
                "value": v.get("value") if isinstance(v, dict) else None,
                "confidence": v.get("confidence") if isinstance(v, dict) else None,
                "type_hint": v.get("type_hint") if isinstance(v, dict) else None,
            }
            for k, v in source_for_extracted.items()
        }

        extracted_full = {
            k: {
                "value": v.get("value") if isinstance(v, dict) else None,
                "confidence": v.get("confidence") if isinstance(v, dict) else None,
                "type_hint": v.get("type_hint") if isinstance(v, dict) else None,
            }
            for k, v in source_for_full.items()
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
        extracted_full=extracted_full,
        corrected=corrected,
    )


@router.post("/hil/{document_id}", response_model=HilUpdateResponse)
@requires_role("reviewer", "admin")
async def update_hil_corrections(
    document_id: int,
    request: HilUpdateRequest,
    current_user=Depends(get_current_active_user),
):
    """Apply human corrections to a document."""

    try:
        # Apply corrections
        apply_document_corrections(
            document_id=document_id,
            corrections=request.corrections,
            reviewer=request.reviewer,
            notes=request.notes,
        )

        return HilUpdateResponse(
            document_id=document_id,
            state=PipelineState.HIL_CONFIRMED,
            corrections_applied=len(request.corrections),
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"HIL update failed: {str(e)}")
