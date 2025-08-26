"""Finalization service for approving/rejecting documents - Step 5."""

from ..db import get_session_sync
from ..enums import Decision, PipelineState
from ..models import Document, FinalDecision
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

            if document.state != PipelineState.RECONCILED:
                raise ValueError(f"Document {document_id} is not ready for finalization")

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
