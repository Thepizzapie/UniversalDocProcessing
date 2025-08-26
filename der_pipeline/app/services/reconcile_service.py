"""Reconciliation service for comparing extracted vs fetched data - Step 4."""

from typing import Any

from loguru import logger
from rapidfuzz import fuzz

from ..config import settings
from ..db import get_session_sync
from ..enums import ActorType, PipelineState, ReconcileStatus, ReconcileStrategy
from ..models import Document, ReconciliationResult
from ..schemas import ReconcileDiff
from .audit import log_audit_event


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
                latest_correction = max(document.hil_corrections, key=lambda x: x.timestamp)

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
                raise ValueError(f"Document {document_id} is not ready for reconciliation")

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

            # Perform reconciliation using appropriate strategy
            logger.info(f"Starting reconciliation with strategy: {strategy}")
            results, overall_score = ReconcileService._reconcile_data(
                corrected_data, fetched_data, strategy
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
                actor_type=ActorType.SYSTEM,
                action="reconciliation_completed",
                from_state=old_state,
                to_state=PipelineState.RECONCILED,
                payload={
                    "reconciliation_id": reconciliation.id,
                    "strategy": strategy.value,
                    "overall_score": overall_score,
                    "fields_compared": len(results),
                },
                session=session,
            )

            return reconciliation

    @staticmethod
    def _reconcile_data(
        extracted_data: dict[str, Any], fetched_data: dict[str, Any], strategy: ReconcileStrategy
    ) -> tuple[list[ReconcileDiff], float]:
        """Reconcile extracted vs fetched data using specified strategy."""

        # Get all unique field names
        all_fields = set(extracted_data.keys()) | set(fetched_data.keys())
        results = []
        scores = []

        for field in all_fields:
            extracted_value = extracted_data.get(field)
            fetched_value = fetched_data.get(field)

            # Get actual values if they're in field format
            if isinstance(extracted_value, dict) and "value" in extracted_value:
                extracted_value = extracted_value["value"]
            if isinstance(fetched_value, dict) and "value" in fetched_value:
                fetched_value = fetched_value["value"]

            diff = ReconcileService._compare_values(field, extracted_value, fetched_value, strategy)
            results.append(diff)
            scores.append(diff.match_score)

        # Calculate overall score
        overall_score = sum(scores) / len(scores) if scores else 0.0

        return results, overall_score

    @staticmethod
    def _compare_values(
        field: str, extracted_value: Any, fetched_value: Any, strategy: ReconcileStrategy
    ) -> ReconcileDiff:
        """Compare two values using the specified reconciliation strategy."""

        # Handle missing values
        if extracted_value is None and fetched_value is None:
            return ReconcileDiff(
                field=field,
                extracted_value=extracted_value,
                fetched_value=fetched_value,
                match_score=1.0,
                status=ReconcileStatus.MISSING_BOTH,
            )

        if extracted_value is None:
            return ReconcileDiff(
                field=field,
                extracted_value=extracted_value,
                fetched_value=fetched_value,
                match_score=0.0,
                status=ReconcileStatus.ONLY_FETCHED,
            )

        if fetched_value is None:
            return ReconcileDiff(
                field=field,
                extracted_value=extracted_value,
                fetched_value=fetched_value,
                match_score=0.0,
                status=ReconcileStatus.ONLY_EXTRACTED,
            )

        # Apply strategy-specific comparison
        if strategy == ReconcileStrategy.STRICT:
            return ReconcileService._strict_compare(field, extracted_value, fetched_value)
        elif strategy == ReconcileStrategy.LOOSE:
            return ReconcileService._loose_compare(field, extracted_value, fetched_value)
        elif strategy == ReconcileStrategy.FUZZY:
            return ReconcileService._fuzzy_compare(field, extracted_value, fetched_value)
        else:
            # Default to loose
            return ReconcileService._loose_compare(field, extracted_value, fetched_value)

    @staticmethod
    def _strict_compare(field: str, extracted_value: Any, fetched_value: Any) -> ReconcileDiff:
        """Strict comparison - values must be exactly equal."""
        match = extracted_value == fetched_value

        return ReconcileDiff(
            field=field,
            extracted_value=extracted_value,
            fetched_value=fetched_value,
            match_score=1.0 if match else 0.0,
            status=ReconcileStatus.MATCH if match else ReconcileStatus.MISMATCH,
        )

    @staticmethod
    def _loose_compare(field: str, extracted_value: Any, fetched_value: Any) -> ReconcileDiff:
        """Loose comparison - normalize and compare."""

        # Normalize values for comparison
        norm_extracted = ReconcileService._normalize_value(extracted_value)
        norm_fetched = ReconcileService._normalize_value(fetched_value)

        match = norm_extracted == norm_fetched

        return ReconcileDiff(
            field=field,
            extracted_value=extracted_value,
            fetched_value=fetched_value,
            match_score=1.0 if match else 0.0,
            status=ReconcileStatus.MATCH if match else ReconcileStatus.MISMATCH,
        )

    @staticmethod
    def _fuzzy_compare(field: str, extracted_value: Any, fetched_value: Any) -> ReconcileDiff:
        """Fuzzy comparison using string similarity."""

        # Convert to strings for fuzzy comparison
        str_extracted = str(extracted_value).strip().lower()
        str_fetched = str(fetched_value).strip().lower()

        # Use RapidFuzz for similarity scoring
        similarity = fuzz.ratio(str_extracted, str_fetched) / 100.0

        # Check if similarity meets threshold
        threshold = settings.fuzzy_threshold
        match = similarity >= threshold

        return ReconcileDiff(
            field=field,
            extracted_value=extracted_value,
            fetched_value=fetched_value,
            match_score=similarity,
            status=ReconcileStatus.MATCH if match else ReconcileStatus.MISMATCH,
        )

    @staticmethod
    def _normalize_value(value: Any) -> str:
        """Normalize a value for loose comparison."""

        if value is None:
            return ""

        # Convert to string and normalize
        str_value = str(value).strip().lower()

        # Handle numeric values
        try:
            # Try to parse as float for numeric comparison
            float_value = float(str_value.replace(",", "").replace("$", ""))
            return f"{float_value:.2f}"
        except (ValueError, TypeError):
            pass

        # Handle date-like strings (basic normalization)
        import re

        date_patterns = [
            r"\d{4}-\d{2}-\d{2}",  # YYYY-MM-DD
            r"\d{2}/\d{2}/\d{4}",  # MM/DD/YYYY
            r"\d{2}-\d{2}-\d{4}",  # MM-DD-YYYY
        ]

        for pattern in date_patterns:
            if re.match(pattern, str_value):
                # Basic date normalization - could be more sophisticated
                return re.sub(r"[-/]", "", str_value)

        # Remove extra whitespace and punctuation for text
        normalized = re.sub(r"\s+", " ", str_value)
        normalized = re.sub(r"[^\w\s]", "", normalized)

        return normalized

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
