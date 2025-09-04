"""Reconcile router - Step 4 of the pipeline."""

from fastapi import APIRouter, HTTPException

from ..db import get_session_sync
from ..enums import PipelineState
from ..models import Document
from ..schemas import ReconcileRequest, ReconcileResponse
from ..services.reconcile_service import reconcile_document_data

router = APIRouter()


@router.post("/reconcile/{document_id}", response_model=ReconcileResponse)
async def reconcile_document(document_id: int, request: ReconcileRequest):
    """Reconcile extracted vs fetched data."""

    # Check if document exists and is ready for reconciliation
    with get_session_sync() as session:
        document = session.get(Document, document_id)
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")

        if document.state != PipelineState.FETCHED:
            raise HTTPException(
                status_code=400,
                detail=f"Document {document_id} is not ready for reconciliation (current state: {document.state.value})",
            )

    try:
        # Perform reconciliation
        reconciliation_result = reconcile_document_data(
            document_id=document_id, strategy=request.strategy
        )

        # Convert result to response format
        results = []
        for result in reconciliation_result.result_json:
            results.append(
                {
                    "field": result["field"],
                    "extracted_value": result["extracted_value"],
                    "fetched_value": result["fetched_value"],
                    "match_score": result["match_score"],
                    "status": result["status"],
                }
            )

        return ReconcileResponse(
            document_id=document_id,
            state=PipelineState.RECONCILED,
            result=results,
            score_overall=reconciliation_result.score_overall,
            strategy_used=reconciliation_result.strategy,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reconciliation failed: {str(e)}")


@router.get("/reconcile/{document_id}/results")
async def get_reconciliation_results(document_id: int):
    """Get reconciliation results for a document."""

    with get_session_sync() as session:
        document = session.get(Document, document_id)
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")

        if not document.reconciliation_results:
            raise HTTPException(status_code=404, detail="No reconciliation results found")

        # Get latest reconciliation
        latest = max(document.reconciliation_results, key=lambda x: x.created_at)

        return {
            "document_id": document_id,
            "reconciliation_id": latest.id,
            "strategy": latest.strategy.value,
            "score_overall": latest.score_overall,
            "results": latest.result_json,
            "created_at": latest.created_at.isoformat(),
        }
