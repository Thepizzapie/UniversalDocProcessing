"""Finalization service for approving/rejecting documents - Step 5."""

from ..db import get_session_sync
from ..enums import Decision, PipelineState
from ..models import Document, FinalDecision, Extraction, CustomDocTypeDefinition
from .audit import log_audit_event


class FinalizeService:
    """Service for finalizing document processing."""

    @staticmethod
    def finalize_document(
        document_id: int, decision: Decision, decider: str, notes: str | None = None
    ) -> FinalDecision:
        """Finalize a document with approval or rejection."""

        with get_session_sync() as session:
            document = session.get(Document, document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")

            # Gatekeeping: normally require RECONCILED; if the pipeline has no 'reconcile' step,
            # allow finalize after HIL has been confirmed. If we're in a custom flow but cannot
            # find a matching config, default to a simple pipeline (no reconcile) to avoid
            # accidentally blocking custom-forced flows.
            if document.state != PipelineState.RECONCILED:
                allow_without_reconcile = False
                try:
                    # Inspect latest extraction meta to find custom doc type name
                    latest_extraction = (
                        session.query(Extraction)
                        .filter(Extraction.document_id == document_id)
                        .order_by(Extraction.id.desc())
                        .first()
                    )
                    custom_name = None
                    extraction_mode = None
                    if latest_extraction and isinstance(latest_extraction.raw_json, dict):
                        fields = latest_extraction.raw_json.get("instructed_fields") or latest_extraction.raw_json
                        meta = fields.get("_custom_doc_type_name")
                        if isinstance(meta, dict):
                            custom_name = meta.get("value")
                        elif isinstance(meta, str):
                            custom_name = meta
                        # extraction mode meta (e.g., custom / custom_forced)
                        mode_meta = fields.get("_extraction_mode")
                        if isinstance(mode_meta, dict):
                            extraction_mode = (mode_meta.get("value") or "").lower()
                        elif isinstance(mode_meta, str):
                            extraction_mode = mode_meta.lower()

                    has_reconcile: bool | None = None
                    if custom_name and document.tenant_id:
                        # Case-insensitive match in Python to avoid DB-specific ILIKE behavior
                        all_defs = (
                            session.query(CustomDocTypeDefinition)
                            .filter(CustomDocTypeDefinition.tenant_id == document.tenant_id)
                            .all()
                        )
                        norm = lambda s: (s or "").strip().lower()
                        target = norm(custom_name)
                        cfg = None
                        for d in all_defs:
                            if norm(d.name) == target:
                                cfg = d
                                break
                        steps = (cfg.pipeline_config or {}).get("steps", []) if cfg else []
                        if steps:
                            has_reconcile = any((s.get("step_type") or s.get("type") or "").lower() == "reconcile" for s in steps)

                    # If we're in a custom flow but couldn't find a config, assume simple flow (no reconcile)
                    is_custom_flow = (custom_name is not None) or (extraction_mode or "").find("custom") >= 0
                    if has_reconcile is None and is_custom_flow:
                        has_reconcile = False

                    # For explicitly forced custom flows, treat as simple pipeline (no reconcile)
                    if (extraction_mode or "").find("custom_forced") >= 0:
                        has_reconcile = False

                    if has_reconcile is False and document.state == PipelineState.HIL_CONFIRMED:
                        allow_without_reconcile = True
                except Exception:
                    allow_without_reconcile = False

                if not allow_without_reconcile:
                    # Provide a clearer message for the UI
                    raise ValueError(
                        "Document is not ready for finalization. "
                        "If this is a custom flow without reconciliation, ensure HIL is confirmed; "
                        "otherwise complete Reconcile first."
                    )

            # Check if already finalized
            existing_decision = (
                session.query(FinalDecision)
                .filter(FinalDecision.document_id == document_id)
                .first()
            )

            if existing_decision:
                raise ValueError(f"Document {document_id} has already been finalized")

            # Create final decision
            final_decision = FinalDecision(
                document_id=document_id, decision=decision, decider=decider, notes=notes
            )

            session.add(final_decision)

            # Update document state
            old_state = document.state
            if decision == Decision.APPROVED:
                document.state = PipelineState.APPROVED
            else:
                document.state = PipelineState.REJECTED

            session.commit()

            # Log audit event
            log_audit_event(
                document_id=document_id,
                action="document_finalized",
                from_state=old_state,
                to_state=document.state,
                payload={
                    "decision": decision.value,
                    "decider": decider,
                    "final_decision_id": final_decision.id,
                },
            )

            return final_decision

    @staticmethod
    def get_final_decision(document_id: int) -> FinalDecision | None:
        """Get final decision for a document."""

        with get_session_sync() as session:
            return (
                session.query(FinalDecision)
                .filter(FinalDecision.document_id == document_id)
                .first()
            )

    @staticmethod
    def can_modify_document(document_id: int) -> bool:
        """Check if a document can still be modified."""

        with get_session_sync() as session:
            document = session.get(Document, document_id)
            if not document:
                return False

            # Document is locked once finalized
            return document.state not in (
                PipelineState.APPROVED,
                PipelineState.REJECTED,
            )


def finalize_document_processing(
    document_id: int, decision: Decision, decider: str, notes: str | None = None
) -> FinalDecision:
    """Convenience function to finalize document processing."""
    return FinalizeService.finalize_document(document_id, decision, decider, notes)
