"""Fetch service for external data retrieval - Step 3 of the pipeline."""

from datetime import datetime
from typing import Any

from loguru import logger

from ..db import get_session_sync
from ..enums import ActorType, FetchStatus, PipelineState
from ..models import Document, FetchJob
from ..schemas import FetchedRecord
from .audit import log_audit_event
from .connectors import accounting_api, dummy_json, rest_endpoint, sql_query


class FetchService:
    """Service for fetching comparator data from external sources."""

    @staticmethod
    def fetch_external_data(target: str, document: Document) -> FetchedRecord:
        """Fetch data from a specific external source using connector strategy."""

        # Prepare document data for connectors
        document_data = {
            "document_id": document.id,
            "document_type": (
                document.document_type.value
                if hasattr(document.document_type, "value")
                else str(document.document_type)
            ),
            "filename": document.filename,
            "mime_type": document.mime_type,
            "content_preview": document.content[:200] if document.content else None,
        }

        try:
            # Route to appropriate connector
            if target == "dummy_json":
                payload = dummy_json.fetch_data(document_data)
            elif target == "accounting_api":
                api_config = {"endpoint": "https://api.demo-accounting.com", "api_key": "demo_key"}
                payload = accounting_api.fetch_data(api_config, document_data)
            elif target.startswith("http"):
                # REST endpoint
                payload = rest_endpoint.fetch_data_sync(target, document_data)
            elif target.startswith("postgresql://") or target.startswith("mysql://"):
                # SQL query - extract query from target or use default
                query = "SELECT * FROM validation_data WHERE document_type = %(document_type)s"
                payload = sql_query.fetch_data(target, query, document_data)
            else:
                # Unknown target - use dummy data
                logger.warning(f"Unknown fetch target: {target}, using dummy data")
                payload = dummy_json.fetch_data(document_data)

            return FetchedRecord(source=target, payload=payload)

        except Exception as e:
            logger.error(f"Fetch failed for target {target}: {e}")
            return FetchedRecord(source=target, payload={"error": f"Fetch failed: {str(e)}"})

    @staticmethod
    def run_fetch(document_id: int, targets: list[str]) -> FetchJob:
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
            document.state = PipelineState.FETCH_PENDING
            session.commit()

        try:
            # Fetch from all targets
            response_payloads = {}

            for target in targets:
                try:
                    fetched_record = FetchService.fetch_external_data(target, document)
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
                            actor_type=ActorType.SYSTEM,
                            action="fetch_completed",
                            from_state=old_doc_state,
                            to_state=PipelineState.FETCHED,
                            payload={
                                "fetch_job_id": fetch_job.id,
                                "targets": targets,
                                "successful_fetches": len(
                                    [r for r in response_payloads.values() if r["success"]]
                                ),
                            },
                            session=session,
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
                        actor_type=ActorType.SYSTEM,
                        action="fetch_failed",
                        from_state=PipelineState.FETCH_PENDING,
                        to_state=PipelineState.FAILED,
                        payload={"error": str(e)},
                        session=session,
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
                    latest_fetch.started_at.isoformat() if latest_fetch.started_at else None
                ),
                "finished_at": (
                    latest_fetch.finished_at.isoformat() if latest_fetch.finished_at else None
                ),
            }


def fetch_comparator_data(document_id: int, targets: list[str]) -> FetchJob:
    """Convenience function to fetch comparator data."""
    return FetchService.run_fetch(document_id, targets)
