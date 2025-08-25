"""Human-in-the-Loop service - Step 2 of the pipeline."""

from ..db import get_session_sync
from ..enums import PipelineState
from ..models import Document, HilCorrection
from ..schemas import CorrectedRecord
from .audit import log_audit_event


class HilService:
    """Service for managing human-in-the-loop corrections."""

    @staticmethod
    def get_correction_data(document_id: int) -> dict | None:
        """Get current correction data for a document."""

        with get_session_sync() as session:
            document = session.get(Document, document_id)
            if not document:
                return None

            # Get latest extraction
            latest_extraction = None
            if document.extractions:
                latest_extraction = max(
                    document.extractions, key=lambda x: x.created_at
                )

            # Get latest correction
            latest_correction = None
            if document.hil_corrections:
                latest_correction = max(
                    document.hil_corrections, key=lambda x: x.timestamp
                )

            return {
                "document": document,
                "extraction": latest_extraction,
                "correction": latest_correction,
            }

    @staticmethod
    def apply_corrections(
        document_id: int,
        corrections: CorrectedRecord,
        reviewer: str,
        notes: str | None = None,
    ) -> HilCorrection:
        """Apply human corrections to a document."""

        with get_session_sync() as session:
            document = session.get(Document, document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")

            if document.state != PipelineState.HIL_REQUIRED:
                raise ValueError(f"Document {document_id} is not in HIL_REQUIRED state")

            # Create correction record
            correction = HilCorrection(
                document_id=document_id,
                corrected_json={
                    k: {
                        "value": v.value,
                        "confidence": v.confidence,
                        "type_hint": v.type_hint,
                        "correction_reason": v.correction_reason,
                    }
                    for k, v in corrections.root.items()
                },
                reviewer=reviewer,
                notes=notes,
            )

            session.add(correction)

            # Update document state
            old_state = document.state
            document.state = PipelineState.HIL_CONFIRMED
            session.commit()

            # Log audit event
            log_audit_event(
                document_id=document_id,
                action="hil_corrections_applied",
                from_state=old_state,
                to_state=PipelineState.HIL_CONFIRMED,
                payload={
                    "correction_id": correction.id,
                    "reviewer": reviewer,
                    "fields_corrected": len(corrections.root),
                },
            )

        return correction

    @staticmethod
    def get_correction_summary(document_id: int) -> dict:
        """Get summary of corrections for a document."""

        correction_data = HilService.get_correction_data(document_id)
        if not correction_data:
            return {}

        correction = correction_data["correction"]
        if not correction:
            return {}

        return {
            "correction_id": correction.id,
            "reviewer": correction.reviewer,
            "timestamp": correction.timestamp.isoformat(),
            "fields_corrected": len(correction.corrected_json),
            "notes": correction.notes,
        }


def apply_document_corrections(
    document_id: int,
    corrections: CorrectedRecord,
    reviewer: str,
    notes: str | None = None,
) -> HilCorrection:
    """Convenience function to apply document corrections."""
    return HilService.apply_corrections(document_id, corrections, reviewer, notes)
