"""HIL router - Step 2 of the pipeline."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..auth import get_current_active_user  # keep import for future use
from ..db import get_session_sync
from ..enums import PipelineState, Decision
from ..models import Document
from ..schemas import HilResponse, HilUpdateRequest, HilUpdateResponse, HilReviewRequest, HilReviewResponse
from ..services.hil_service import HilService, apply_document_corrections
from ..utils.validation import validate_correction_fields

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.get("/hil/{document_id}", response_model=HilResponse)
async def get_hil_data(
    document_id: int,
    # current_user=Depends(get_current_active_user),  # Temporarily disabled for testing
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
async def update_hil_corrections(
    document_id: int,
    request: HilUpdateRequest,
    # current_user=Depends(get_current_active_user),  # Temporarily disabled for testing
):
    """Apply human corrections to a document."""

    try:

        # Basic validation against extracted fields
        original = {}  # default
        with get_session_sync() as session:
            from ..models import Extraction

            extraction = (
                session.query(Extraction)
                .filter(Extraction.document_id == document_id)
                .order_by(Extraction.id.desc())
                .first()
            )
            if extraction:
                original = extraction.raw_json.get("all_fields", {}) if extraction.raw_json else {}

        # Convert CorrectedField map to raw values for validation
        raw_corrected = {
            k: (v.value if hasattr(v, "value") else (v.get("value") if isinstance(v, dict) else v))
            for k, v in (request.corrections or {}).items()
        }
        validation_errors = validate_correction_fields(original, raw_corrected)
        if validation_errors:
            raise HTTPException(status_code=400, detail={"validation_errors": validation_errors})

        # Apply corrections after validation
        from ..schemas import CorrectedRecord, CorrectedField
        # Ensure we pass a CorrectedRecord to the service
        corr_map: dict[str, CorrectedField] = {}
        for k, v in (request.corrections or {}).items():
            if hasattr(v, "value"):
                corr_map[k] = v  # already a CorrectedField
            elif isinstance(v, dict):
                # Strip any extra keys we don't need
                safe = {kk: vv for kk, vv in v.items() if kk in {"value", "confidence", "type_hint", "correction_reason"}}
                corr_map[k] = CorrectedField(**safe)

        if not corr_map:
            raise HTTPException(status_code=400, detail="No corrections provided")
        apply_document_corrections(
            document_id=document_id,
            corrections=CorrectedRecord(root=corr_map),
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


@router.post("/hil/{document_id}/review", response_model=HilReviewResponse)
async def submit_hil_review(
    document_id: int,
    request: HilReviewRequest,
    # current_user=Depends(get_current_active_user),  # Temporarily disabled for testing
):
    """Submit HIL review decisions for a document."""

    # Validate request
    if request.document_id != document_id:
        raise HTTPException(status_code=400, detail="Document ID mismatch")

    # Check if document exists and is in correct state
    with get_session_sync() as session:
        document = session.get(Document, document_id)
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")

        if document.state != PipelineState.HIL_REQUIRED:
            raise HTTPException(
                status_code=400,
                detail=f"Document {document_id} is not in HIL review state (current state: {document.state.value})",
            )

    try:
        # Apply review decisions
        from ..services.hil_service import HilService

        # Create a CorrectedRecord from the review decisions
        from ..schemas import CorrectedRecord, CorrectedField

        corrected_map: dict[str, CorrectedField] = {}

        # Process field-level decisions
        for field_review in request.field_reviews:
            field_name = field_review.get("field_name")
            decision = field_review.get("decision", "APPROVED")
            comments = field_review.get("comments", "")

            if field_name:
                # Get the original extracted value to preserve it
                original_value = None
                if hasattr(document, 'latest_extraction') and document.latest_extraction:
                    latest_extraction = document.latest_extraction
                    if isinstance(latest_extraction, dict) and field_name in latest_extraction:
                        field_data = latest_extraction[field_name]
                        if isinstance(field_data, dict) and 'value' in field_data:
                            original_value = field_data['value']

                corrected_map[field_name] = CorrectedField(
                    value=original_value,  # Preserve original value
                    confidence=1.0 if decision == "APPROVED" else 0.0,
                    type_hint="reviewed",
                    correction_reason=f"HIL Review: {decision} - {comments}"
                )

        # Apply the review
        if corrected_map:
            HilService.apply_corrections(
                document_id=document_id,
                corrections=CorrectedRecord(root=corrected_map),
                reviewer="user",
                notes=f"HIL Review: {request.decision} - {request.overall_comments or ''}"
            )

        # Update document state based on overall decision
        final_state = PipelineState.HIL_CONFIRMED  # default
        with get_session_sync() as session:
            doc = session.get(Document, document_id)
            if doc:
                if request.decision == Decision.APPROVED:
                    doc.state = PipelineState.HIL_CONFIRMED
                    final_state = PipelineState.HIL_CONFIRMED
                elif request.decision == Decision.REJECTED:
                    doc.state = PipelineState.REJECTED
                    final_state = PipelineState.REJECTED
                session.commit()

        return HilReviewResponse(
            document_id=document_id,
            decision=request.decision,
            state=final_state,
            reviewed_at=request.reviewed_at or datetime.utcnow(),  # Use default if not provided
            field_reviews_processed=len(request.field_reviews)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"HIL review submission failed: {str(e)}")
