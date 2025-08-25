"""Fetch service for external data retrieval - Step 3 of the pipeline."""

from datetime import datetime
from typing import Any


from ..db import get_session_sync
from ..enums import FetchStatus, PipelineState
from ..models import Document, FetchJob
from ..schemas import FetchedRecord
from .audit import log_audit_event


class FetchService:
    """Service for fetching comparator data from external sources."""

    @staticmethod
    async def fetch_external_data(target: str, document: Document) -> FetchedRecord:
        """Fetch data from a specific external source."""

        # Import here to avoid circular imports
        from ..adapters.external_apis import get_external_api_adapter

        adapter = get_external_api_adapter(target)
        if adapter:
            return await adapter.fetch(document)
        else:
            # Return empty record if adapter not found
            return FetchedRecord(
                source=target,
                payload={"error": f"No adapter found for target: {target}"},
            )

    @staticmethod
    async def run_fetch(document_id: int, targets: list[str]) -> FetchJob:
        """Run fetch job for multiple targets."""

        with get_session_sync() as session:
            document = session.get(Document, document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")

            if document.state not in (
                PipelineState.HIL_CONFIRMED,
                PipelineState.FETCH_PENDING,
            ):
                raise ValueError(f"Document {document_id} is not ready for fetching")

            # Create fetch job
            fetch_job = FetchJob(
                document_id=document_id,
                status=FetchStatus.IN_PROGRESS,
                targets=targets,
                response_payloads={},
                started_at=datetime.utcnow(),
            )

            session.add(fetch_job)
            session.commit()
            session.refresh(fetch_job)

            # Update document state
            old_state = document.state
            document.state = PipelineState.FETCH_PENDING
            session.commit()

        try:
            # Fetch from all targets
            response_payloads = {}

            for target in targets:
                try:
                    fetched_record = await FetchService.fetch_external_data(
                        target, document
                    )
                    response_payloads[target] = {
                        "source": fetched_record.source,
                        "payload": fetched_record.payload,
                        "success": True,
                    }
                except Exception as e:
                    response_payloads[target] = {
                        "source": target,
                        "payload": {"error": str(e)},
                        "success": False,
                    }

            # Update fetch job with results
            with get_session_sync() as session:
                fetch_job = session.get(FetchJob, fetch_job.id)
                if fetch_job:
                    fetch_job.response_payloads = response_payloads
                    fetch_job.status = FetchStatus.COMPLETED
                    fetch_job.finished_at = datetime.utcnow()
                    session.commit()

                    # Update document state
                    document = session.get(Document, document_id)
                    if document:
                        old_doc_state = document.state
                        document.state = PipelineState.FETCHED
                        session.commit()

                        # Log audit event
                        log_audit_event(
                            document_id=document_id,
                            action="fetch_completed",
                            from_state=old_doc_state,
                            to_state=PipelineState.FETCHED,
                            payload={
                                "fetch_job_id": fetch_job.id,
                                "targets": targets,
                                "successful_fetches": len(
                                    [
                                        r
                                        for r in response_payloads.values()
                                        if r["success"]
                                    ]
                                ),
                            },
                        )

        except Exception as e:
            # Handle fetch failure
            with get_session_sync() as session:
                fetch_job = session.get(FetchJob, fetch_job.id)
                if fetch_job:
                    fetch_job.status = FetchStatus.FAILED
                    fetch_job.finished_at = datetime.utcnow()
                    fetch_job.response_payloads = {"error": str(e)}
                    session.commit()

                document = session.get(Document, document_id)
                if document:
                    document.state = PipelineState.FAILED
                    session.commit()

                    log_audit_event(
                        document_id=document_id,
                        action="fetch_failed",
                        from_state=PipelineState.FETCH_PENDING,
                        to_state=PipelineState.FAILED,
                        payload={"error": str(e)},
                    )

            raise

        return fetch_job

    @staticmethod
    def get_fetch_results(document_id: int) -> dict[str, Any]:
        """Get fetch results for a document."""

        with get_session_sync() as session:
            document = session.get(Document, document_id)
            if not document:
                return {}

            latest_fetch = None
            if document.fetch_jobs:
                latest_fetch = max(document.fetch_jobs, key=lambda x: x.created_at)

            if not latest_fetch:
                return {}

            return {
                "fetch_job_id": latest_fetch.id,
                "status": latest_fetch.status.value,
                "targets": latest_fetch.targets,
                "response_payloads": latest_fetch.response_payloads,
                "started_at": (
                    latest_fetch.started_at.isoformat()
                    if latest_fetch.started_at
                    else None
                ),
                "finished_at": (
                    latest_fetch.finished_at.isoformat()
                    if latest_fetch.finished_at
                    else None
                ),
            }


async def fetch_comparator_data(document_id: int, targets: list[str]) -> FetchJob:
    """Convenience function to fetch comparator data."""
    return await FetchService.run_fetch(document_id, targets)
