"""Reports router - Consolidated document processing reports and utilities."""

from fastapi import APIRouter, HTTPException

from ..db import get_session_sync
from ..enums import PipelineState, ReconcileStrategy
from ..models import (
    Document,
    CustomDocTypeDefinition,
    Extraction,
    HilCorrection,
    FetchJob,
    ReconciliationResult,
    FinalDecision,
    AuditTrail,
)
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
    # Track custom pipeline info
    pipeline_step_types: list[str] | None = None
    pipeline_custom_doc_type_name: str | None = None
    if hil_data.get("extraction"):
        payload = hil_data["extraction"].raw_json or {}
        # Our ExtractionService stores fields under 'instructed_fields' and 'all_fields'. Prefer instructed_fields.
        if isinstance(payload, dict):
            fields_map = None
            if isinstance(payload.get("instructed_fields"), dict):
                fields_map = payload.get("instructed_fields")
            elif isinstance(payload.get("all_fields"), dict):
                fields_map = payload.get("all_fields")
            else:
                # Backward compatibility: treat entire payload as fields
                fields_map = payload

            latest_extraction = {}
            for k, v in fields_map.items():
                if isinstance(v, dict) and "value" in v:
                    latest_extraction[k] = {
                        "value": v.get("value"),
                        "confidence": v.get("confidence", 1.0),
                        "type_hint": v.get("type_hint", "string"),
                    }
                else:
                    # Handle simple values that aren't structured as objects
                    latest_extraction[k] = {
                        "value": v,
                        "confidence": 1.0,
                        "type_hint": "string",
                    }

            # Determine custom pipeline config from meta
            try:
                mode_meta = None
                name_meta = None
                x = latest_extraction
                # Accept both raw meta and nested value forms
                if isinstance(x.get("_extraction_mode"), dict):
                    mode_meta = x.get("_extraction_mode", {}).get("value")
                else:
                    mode_meta = x.get("_extraction_mode")
                if isinstance(x.get("_custom_doc_type_name"), dict):
                    name_meta = x.get("_custom_doc_type_name", {}).get("value")
                else:
                    name_meta = x.get("_custom_doc_type_name")
                pipeline_custom_doc_type_name = name_meta
                is_custom = (mode_meta or "").lower().find("custom") >= 0 or bool(name_meta)
                if is_custom:
                    with get_session_sync() as session:
                        cfg = (
                            session.query(CustomDocTypeDefinition)
                            .filter(CustomDocTypeDefinition.tenant_id == document.tenant_id)
                            .filter(CustomDocTypeDefinition.name == name_meta)
                            .first()
                        )
                        if cfg and isinstance(cfg.pipeline_config, dict):
                            steps = cfg.pipeline_config.get("steps") or []
                            pipeline_step_types = [s.get("step_type") for s in steps if isinstance(s, dict) and s.get("step_type")]
                            logger.info(f"DEBUG: Found custom pipeline config with steps: {pipeline_step_types}")
                        # Fallback minimal pipeline for custom without config
                        if not pipeline_step_types:
                            pipeline_step_types = ["hil", "send"]
                            logger.info(f"DEBUG: Using fallback pipeline_step_types: {pipeline_step_types}")
            except Exception:
                # Non-fatal
                pass

    # Format corrected data
    latest_correction = None
    if hil_data.get("correction"):
        latest_correction = {}
        for k, v in hil_data["correction"].corrected_json.items():
            if isinstance(v, dict):
                latest_correction[k] = {
                    "value": v.get("value", v),  # Use the whole value if no "value" key exists
                    "confidence": v.get("confidence", 1.0),
                    "type_hint": v.get("type_hint", "string"),
                    "correction_reason": v.get("correction_reason"),
                }
            else:
                # Handle simple values that aren't structured as objects
                latest_correction[k] = {
                    "value": v,
                    "confidence": 1.0,
                    "type_hint": "string",
                    "correction_reason": None,
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
        pipeline_step_types=pipeline_step_types,
        pipeline_custom_doc_type_name=pipeline_custom_doc_type_name,
    )


@router.delete("/reports/documents/{document_id}")
async def delete_document(document_id: int):
    """Delete a document and its related records if it's not finalized.

    Allowed when state is not APPROVED or REJECTED. This helps clean up pending/test uploads.
    """

    with get_session_sync() as session:
        doc = session.get(Document, document_id)
        if not doc:
            raise HTTPException(status_code=404, detail=f"Document {document_id} not found")

        if doc.state in (PipelineState.APPROVED, PipelineState.REJECTED):
            raise HTTPException(
                status_code=409,
                detail=f"Document {document_id} is finalized and cannot be deleted",
            )

        # Delete child rows first to satisfy FK constraints
        session.query(Extraction).filter(Extraction.document_id == document_id).delete()
        session.query(HilCorrection).filter(HilCorrection.document_id == document_id).delete()
        session.query(FetchJob).filter(FetchJob.document_id == document_id).delete()
        session.query(ReconciliationResult).filter(
            ReconciliationResult.document_id == document_id
        ).delete()
        session.query(FinalDecision).filter(FinalDecision.document_id == document_id).delete()
        session.query(AuditTrail).filter(AuditTrail.document_id == document_id).delete()

        session.delete(doc)
        session.commit()

        return {"status": "deleted", "document_id": document_id}
