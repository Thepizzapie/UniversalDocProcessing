"""Celery tasks for async processing."""

from celery import current_task
from loguru import logger

from .celery_app import celery_app
from app.db import get_session_sync
from app.enums import ActorType, FetchStatus, PipelineState
from app.models import Document, FetchJob
from app.services.audit import log_audit_event
from app.services.fetch_service import FetchService
from app.services.reconcile_service import ReconcileService
from app.services.extraction import ExtractionService


@celery_app.task(bind=True)
def fetch_target(self, document_id: int, target_name: str, config: dict):
    """Fetch data from a specific target for a document."""

    try:
        logger.info(f"Starting fetch task for document {document_id}, target: {target_name}")

        with get_session_sync() as session:
            document = session.get(Document, document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")

            # Fetch data using the service
            fetched_record = FetchService.fetch_external_data(target_name, document)

            # Update task state
            current_task.update_state(
                state="SUCCESS",
                meta={"target": target_name, "status": "completed", "data": fetched_record.payload},
            )

            logger.info(f"Fetch task completed for document {document_id}, target: {target_name}")

            return {"target": target_name, "status": "success", "data": fetched_record.payload}

    except Exception as e:
        logger.error(f"Fetch task failed for document {document_id}, target {target_name}: {e}")

        current_task.update_state(
            state="FAILURE", meta={"target": target_name, "status": "failed", "error": str(e)}
        )

        # Log audit event
        with get_session_sync() as session:
            log_audit_event(
                document_id=document_id,
                actor_type=ActorType.SYSTEM,
                action="fetch_target_failed",
                payload={"target": target_name, "error": str(e), "task_id": self.request.id},
                session=session,
            )

        raise


@celery_app.task(bind=True)
def ocr_document(self, document_id: int):
    """Process OCR for a document."""

    try:
        logger.info(f"Starting OCR task for document {document_id}")

        with get_session_sync() as session:
            document = session.get(Document, document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")

            # Re-extract document with updated content
            extracted_data = ExtractionService.extract(document)

            # Update task state
            current_task.update_state(
                state="SUCCESS",
                meta={
                    "document_id": document_id,
                    "status": "completed",
                    "fields_extracted": len(extracted_data.root),
                },
            )

            logger.info(f"OCR task completed for document {document_id}")

            return {
                "document_id": document_id,
                "status": "success",
                "fields_extracted": len(extracted_data.root),
            }

    except Exception as e:
        logger.error(f"OCR task failed for document {document_id}: {e}")

        current_task.update_state(
            state="FAILURE", meta={"document_id": document_id, "status": "failed", "error": str(e)}
        )

        # Log audit event
        with get_session_sync() as session:
            log_audit_event(
                document_id=document_id,
                actor_type=ActorType.SYSTEM,
                action="ocr_task_failed",
                payload={"error": str(e), "task_id": self.request.id},
                session=session,
            )

        raise


@celery_app.task(bind=True)
def reconcile_document(self, document_id: int, strategy: str):
    """Perform reconciliation for a document."""

    try:
        from app.enums import ReconcileStrategy

        logger.info(f"Starting reconciliation task for document {document_id}")

        # Convert string strategy to enum
        reconcile_strategy = ReconcileStrategy(strategy)

        # Perform reconciliation
        result = ReconcileService.reconcile(document_id, reconcile_strategy)

        # Update task state
        current_task.update_state(
            state="SUCCESS",
            meta={
                "document_id": document_id,
                "status": "completed",
                "reconciliation_id": result.id,
                "overall_score": result.score_overall,
            },
        )

        logger.info(f"Reconciliation task completed for document {document_id}")

        return {
            "document_id": document_id,
            "status": "success",
            "reconciliation_id": result.id,
            "overall_score": result.score_overall,
        }

    except Exception as e:
        logger.error(f"Reconciliation task failed for document {document_id}: {e}")

        current_task.update_state(
            state="FAILURE", meta={"document_id": document_id, "status": "failed", "error": str(e)}
        )

        # Log audit event
        with get_session_sync() as session:
            log_audit_event(
                document_id=document_id,
                actor_type=ActorType.SYSTEM,
                action="reconcile_task_failed",
                payload={"strategy": strategy, "error": str(e), "task_id": self.request.id},
                session=session,
            )

        raise
