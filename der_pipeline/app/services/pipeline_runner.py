"""Pipeline runner that executes custom pipeline steps for a document."""

from __future__ import annotations

from typing import Any

from loguru import logger

from ..db import get_session_sync
from ..enums import PipelineState, ReconcileStrategy
from ..models import Document, CustomDocTypeDefinition
from ..schemas import CorrectedField, CorrectedRecord
from .extraction import ExtractionService
from .hil_service import HilService
from .fetch_service import FetchService
from .reconcile_service import ReconcileService
from .webhook_dispatch import WebhookDispatchService


class PipelineRunner:
    """Executes a document's pipeline based on its custom doc-type configuration."""

    @staticmethod
    def _get_custom_def(tenant_id: int | None, name: str | None) -> CustomDocTypeDefinition | None:
        if not tenant_id or not name:
            logger.info(f"DEBUG: _get_custom_def called with tenant_id={tenant_id}, name='{name}' - returning None")
            return None

        logger.info(f"DEBUG: _get_custom_def querying for tenant_id={tenant_id}, name='{name}'")
        with get_session_sync() as session:
            result = (
                session.query(CustomDocTypeDefinition)
                .filter(CustomDocTypeDefinition.tenant_id == tenant_id)
                .filter(CustomDocTypeDefinition.name == name)
                .first()
            )
            logger.info(f"DEBUG: _get_custom_def result: {result.name if result else 'None'} (id: {result.id if result else 'N/A'})")
            return result

    @staticmethod
    def _auto_approve_hil(document_id: int, extracted_root: dict[str, Any]) -> None:
        """Create a synthetic HIL correction using extracted data and move state to HIL_CONFIRMED."""
        # Map ExtractedField-like dict to CorrectedRecord
        corrected_map: dict[str, CorrectedField] = {}
        from ..schemas import ExtractedField as _EF

        for k, v in extracted_root.items():
            if k == "_extraction_mode":
                # skip meta field
                continue
            if isinstance(v, _EF):
                corrected_map[k] = CorrectedField(
                    value=v.value,
                    confidence=v.confidence,
                    type_hint=v.type_hint,
                    correction_reason="auto-approved",
                )
            elif isinstance(v, dict) and "value" in v:
                corrected_map[k] = CorrectedField(
                    value=v.get("value"),
                    confidence=v.get("confidence"),
                    type_hint=v.get("type_hint"),
                    correction_reason="auto-approved",
                )
            else:
                corrected_map[k] = CorrectedField(
                    value=v,
                    confidence=0.8,
                    type_hint=None,
                    correction_reason="auto-approved",
                )

        HilService.apply_corrections(
            document_id,
            CorrectedRecord(root=corrected_map),
            reviewer="system",
            notes="Auto-approved per pipeline",
        )

    @staticmethod
    def run_pipeline(document_id: int, custom_doc_type_name: str | None = None) -> dict[str, Any]:
        """Run the configured pipeline for a document. Returns latest extracted data root."""
        with get_session_sync() as session:
            document = session.get(Document, document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")

        logger.info(f"DEBUG: PipelineRunner running for document {document_id} with custom_doc_type_name: '{custom_doc_type_name}'")
        custom_def = PipelineRunner._get_custom_def(document.tenant_id, custom_doc_type_name)
        logger.info(f"DEBUG: Found custom definition: {custom_def.name if custom_def else 'None'}")

        steps = []
        if custom_def and isinstance(custom_def.pipeline_config, dict):
            steps = custom_def.pipeline_config.get("steps") or []
            logger.info(f"DEBUG: Custom pipeline steps: {len(steps)} steps found")
        else:
            logger.info(f"DEBUG: No custom pipeline config found or invalid format")

        # Default behavior if no steps defined: extraction -> HIL_REQUIRED stop
        if not steps:
            logger.info("No custom steps defined; running default extraction only")
            result = (
                ExtractionService.process_document_forced(document_id, custom_doc_type_name)
                if custom_doc_type_name
                else ExtractionService.process_document(document_id)
            )
            return result.root

        latest_extracted: dict[str, Any] | None = None

        for step in steps:
            step_type = (step.get("step_type") or step.get("type") or "").lower()
            cfg = step.get("config") or {}
            logger.info(f"Running pipeline step: {step_type}")

            if step_type == "extraction":
                result = (
                    ExtractionService.process_document_forced(document_id, custom_doc_type_name)
                    if custom_doc_type_name
                    else ExtractionService.process_document(document_id)
                )
                latest_extracted = result.root

            elif step_type == "hil":
                # Move to HIL_REQUIRED and stop to wait for user action
                with get_session_sync() as session:
                    doc = session.get(Document, document_id)
                    if doc:
                        doc.state = PipelineState.HIL_REQUIRED
                        session.commit()
                logger.info("Pausing pipeline at HIL_REQUIRED")
                break

            elif step_type == "fetch":
                targets: list[str] = cfg.get("targets") or []
                if not targets and custom_def and isinstance(custom_def.pipeline_config, dict):
                    targets = custom_def.pipeline_config.get("global_config", {}).get("fetch_targets", [])

                # Ensure state compatible with FetchService
                with get_session_sync() as session:
                    doc = session.get(Document, document_id)
                    if doc and doc.state not in (PipelineState.HIL_CONFIRMED, PipelineState.FETCH_PENDING):
                        # If no HIL step exists before fetch, auto-approve using extracted data
                        if latest_extracted:
                            # Set to HIL_REQUIRED to pass HilService validation then auto-approve
                            doc.state = PipelineState.HIL_REQUIRED
                            session.commit()
                            PipelineRunner._auto_approve_hil(document_id, latest_extracted)
                        else:
                            # If nothing extracted yet, run extraction quickly
                            result = (
                                ExtractionService.process_document_forced(document_id, custom_doc_type_name)
                                if custom_doc_type_name
                                else ExtractionService.process_document(document_id)
                            )
                            latest_extracted = result.root
                            PipelineRunner._auto_approve_hil(document_id, latest_extracted)

                FetchService.run_fetch(document_id, targets or ["dummy_json"])  # always provide at least one

            elif step_type == "reconcile":
                strategy_name = (cfg.get("strategy") or "LOOSE").upper()
                try:
                    strategy = ReconcileStrategy[strategy_name]
                except Exception:
                    strategy = ReconcileStrategy.LOOSE
                ReconcileService.reconcile(document_id, strategy)

            elif step_type in ("send", "webhook", "dispatch"):
                webhook_url = cfg.get("webhook") or cfg.get("url")
                if webhook_url:
                    # ad-hoc dispatch
                    try:
                        WebhookDispatchService._post(webhook_url, {"document_id": document_id})
                    except Exception as e:
                        logger.warning(f"Webhook ad-hoc dispatch failed: {e}")
                else:
                    # Use custom def's configured webhook
                    try:
                        WebhookDispatchService.dispatch_document_with_custom(document_id, custom_doc_type_name)
                    except Exception as e:
                        logger.warning(f"Webhook dispatch failed: {e}")

            else:
                logger.info(f"Unknown step type: {step_type}; skipping")

        return latest_extracted or {}
