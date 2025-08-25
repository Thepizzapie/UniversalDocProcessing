"""Reconciliation service for comparing extracted vs fetched data - Step 4."""

from typing import Any

from ..db import get_session_sync
from ..enums import PipelineState, ReconcileStrategy
from ..models import Document, ReconciliationResult
from ..utils.diff import reconcile_records
from .audit import log_audit_event
from .crewai_service import crewai_service


class ReconcileService:
    """Service for reconciling extracted and fetched data."""

    @staticmethod
    def get_reconciliation_data(document_id: int) -> dict[str, Any]:
        """Get data needed for reconciliation."""

        with get_session_sync() as session:
            document = session.get(Document, document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")

            # Get latest correction
            latest_correction = None
            if document.hil_corrections:
                latest_correction = max(
                    document.hil_corrections, key=lambda x: x.timestamp
                )

            # Get latest fetch job
            latest_fetch = None
            if document.fetch_jobs:
                latest_fetch = max(document.fetch_jobs, key=lambda x: x.created_at)

            return {
                "document": document,
                "correction": latest_correction,
                "fetch_job": latest_fetch,
            }

    @staticmethod
    def reconcile(
        document_id: int, strategy: ReconcileStrategy = ReconcileStrategy.LOOSE
    ) -> ReconciliationResult:
        """Reconcile extracted vs fetched data."""

        with get_session_sync() as session:
            document = session.get(Document, document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")

            if document.state != PipelineState.FETCHED:
                raise ValueError(
                    f"Document {document_id} is not ready for reconciliation"
                )

            # Get reconciliation data
            data = ReconcileService.get_reconciliation_data(document_id)
            correction = data["correction"]
            fetch_job = data["fetch_job"]

            if not correction or not fetch_job:
                raise ValueError("Missing correction or fetch data for reconciliation")

            # Extract corrected data
            corrected_data = correction.corrected_json

            # Extract fetched data (merge all sources)
            fetched_data = {}
            for target, response in fetch_job.response_payloads.items():
                if response.get("success", False) and "payload" in response:
                    payload = response["payload"]
                    if isinstance(payload, dict):
                        fetched_data.update(payload)

            # Try CrewAI reconciliation first, then fallback to utility function
            results = None
            overall_score = 0.0
            
            # Attempt CrewAI reconciliation
            if crewai_service.is_enabled:
                try:
                    crewai_result = crewai_service.reconcile_data(
                        corrected_data, fetched_data, strategy
                    )
                    if crewai_result:
                        results, overall_score = crewai_result
                except Exception:
                    # Fall back to utility function
                    pass
            
            # Fallback to utility function if CrewAI failed or disabled
            if results is None:
                results, overall_score = reconcile_records(
                    corrected_data, fetched_data, strategy.value
                )

            # Create reconciliation result
            reconciliation = ReconciliationResult(
                document_id=document_id,
                strategy=strategy,
                result_json=[
                    {
                        "field": r.field,
                        "extracted_value": r.extracted_value,
                        "fetched_value": r.fetched_value,
                        "match_score": r.match_score,
                        "status": r.status.value,
                    }
                    for r in results
                ],
                score_overall=overall_score,
            )

            session.add(reconciliation)

            # Update document state
            old_state = document.state
            document.state = PipelineState.RECONCILED
            session.commit()

            # Log audit event
            log_audit_event(
                document_id=document_id,
                action="reconciliation_completed",
                from_state=old_state,
                to_state=PipelineState.RECONCILED,
                payload={
                    "reconciliation_id": reconciliation.id,
                    "strategy": strategy.value,
                    "overall_score": overall_score,
                    "fields_compared": len(results),
                },
            )

            return reconciliation

    @staticmethod
    def get_reconciliation_results(document_id: int) -> dict[str, Any]:
        """Get reconciliation results for a document."""

        with get_session_sync() as session:
            document = session.get(Document, document_id)
            if not document:
                return {}

            latest_reconciliation = None
            if document.reconciliation_results:
                latest_reconciliation = max(
                    document.reconciliation_results, key=lambda x: x.created_at
                )

            if not latest_reconciliation:
                return {}

            return {
                "reconciliation_id": latest_reconciliation.id,
                "strategy": latest_reconciliation.strategy.value,
                "score_overall": latest_reconciliation.score_overall,
                "results": latest_reconciliation.result_json,
                "created_at": latest_reconciliation.created_at.isoformat(),
            }


def reconcile_document_data(
    document_id: int, strategy: ReconcileStrategy = ReconcileStrategy.LOOSE
) -> ReconciliationResult:
    """Convenience function to reconcile document data."""
    return ReconcileService.reconcile(document_id, strategy)
