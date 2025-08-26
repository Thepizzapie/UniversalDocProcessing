"""Reports router - Consolidated document processing reports."""

from fastapi import APIRouter, HTTPException

from ..db import get_session_sync
from ..enums import ReconcileStrategy
from ..models import Document
from ..schemas import DocumentReport, ReconcileResponse
from ..services.audit import AuditService
from ..services.fetch_service import FetchService
from ..services.finalize_service import FinalizeService
from ..services.hil_service import HilService
from ..services.reconcile_service import ReconcileService

router = APIRouter()


@router.get("/reports/documents")
async def get_all_documents():
    """Get all documents with basic info."""

    with get_session_sync() as session:
        documents = session.query(Document).order_by(Document.uploaded_at.desc()).all()

        # Return basic document info for dashboard
        return [
            {
                "document_id": doc.id,
                "filename": doc.filename,
                "document_type": doc.document_type.value,
                "state": doc.state.value,
                "uploaded_at": doc.uploaded_at.isoformat(),
                "mime_type": doc.mime_type,
                "source_uri": doc.source_uri,
            }
            for doc in documents
        ]


@router.get("/reports/{document_id}", response_model=DocumentReport)
async def get_document_report(document_id: int):
    """Get complete processing report for a document."""

    with get_session_sync() as session:
        document = session.get(Document, document_id)
        if not document:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")

    # Gather all document data
    hil_data = HilService.get_correction_data(document_id)
    fetch_data = FetchService.get_fetch_results(document_id)
    reconcile_data = ReconcileService.get_reconciliation_results(document_id)
    final_decision = FinalizeService.get_final_decision(document_id)
    audit_trail = AuditService.get_audit_trail(document_id)

    # Format audit trail
    formatted_audit = [
        {
            "id": audit.id,
            "timestamp": audit.timestamp.isoformat(),
            "actor_type": audit.actor_type.value,
            "actor_id": audit.actor_id,
            "action": audit.action,
            "from_state": audit.from_state.value if audit.from_state else None,
            "to_state": audit.to_state.value if audit.to_state else None,
            "payload": audit.payload,
        }
        for audit in audit_trail
    ]

    # Format extracted data
    latest_extraction = None
    if hil_data.get("extraction"):
        latest_extraction = {
            k: {
                "value": v["value"],
                "confidence": v["confidence"],
                "type_hint": v["type_hint"],
            }
            for k, v in hil_data["extraction"].raw_json.items()
        }

    # Format corrected data
    latest_correction = None
    if hil_data.get("correction"):
        latest_correction = {
            k: {
                "value": v["value"],
                "confidence": v["confidence"],
                "type_hint": v["type_hint"],
                "correction_reason": v.get("correction_reason"),
            }
            for k, v in hil_data["correction"].corrected_json.items()
        }

    # Format final decision
    final_decision_response = None
    if final_decision:
        final_decision_response = {
            "document_id": document_id,
            "state": (
                document.state.value if document.state.name == "APPROVED" else document.state.value
            ),
            "decision": final_decision.decision.value,
            "decider": final_decision.decider,
            "notes": final_decision.notes,
            "finalized_at": final_decision.timestamp.isoformat(),
        }

    return DocumentReport(
        document_id=document_id,
        filename=document.filename,
        state=document.state,
        uploaded_at=document.uploaded_at,
        latest_extraction=latest_extraction,
        latest_correction=latest_correction,
        latest_fetch=fetch_data.get("response_payloads") if fetch_data else None,
        latest_reconciliation=(
            ReconcileResponse(
                document_id=document_id,
                state=document.state,
                result=reconcile_data.get("results", []),
                score_overall=reconcile_data.get("score_overall", 0.0),
                strategy_used=reconcile_data.get("strategy", ReconcileStrategy.LOOSE),
            )
            if reconcile_data
            else None
        ),
        final_decision=final_decision_response,
        audit_trail=formatted_audit,
    )
