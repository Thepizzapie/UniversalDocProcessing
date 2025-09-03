"""Webhook dispatch service.

Sends extracted/reconciled document JSON to a customer-configured webhook URL.
Retries with exponential back-off when the endpoint is unreachable.
"""
from __future__ import annotations

import json
from typing import Any

import requests
from loguru import logger
from tenacity import RetryError, retry, stop_after_attempt, wait_exponential

from ..models import Document, CustomDocTypeDefinition
from ..db import get_session_sync


class WebhookDispatchService:
    """Service responsible for delivering payloads to customer webhook endpoints."""

    MAX_RETRIES = 5

    @staticmethod
    @retry(stop=stop_after_attempt(MAX_RETRIES), wait=wait_exponential(multiplier=2, min=2, max=30))
    def _post(url: str, payload: dict[str, Any]):
        """Internal helper that POSTs JSON with retry."""
        logger.info(f"Dispatching payload to webhook {url}")
        response = requests.post(url, json=payload, timeout=15)
        response.raise_for_status()
        return response

    @classmethod
    def dispatch_document(cls, document_id: int):
        """Fetch document & custom doc type settings; send payload to configured webhook."""
        with get_session_sync() as session:
            doc = session.get(Document, document_id)
            if not doc:
                raise ValueError(f"Document {document_id} not found")

            doc_type_def = (
                session.query(CustomDocTypeDefinition)
                .filter(CustomDocTypeDefinition.name == doc.document_type.value)
                .first()
            )
            if not doc_type_def or not doc_type_def.destination_webhook:
                logger.warning(
                    f"No webhook configured for document {document_id} of type {doc.document_type}"
                )
                return

            payload = {
                "document_id": doc.id,
                "document_type": doc.document_type.value,
                "state": doc.state.value,
                "data": doc.content,  # In real impl you'd embed structured extraction
            }

        try:
            cls._post(doc_type_def.destination_webhook, payload)
            logger.info(f"Webhook dispatch success for document {document_id}")
        except RetryError as exc:
            logger.error(f"Failed to dispatch webhook after retries: {exc}")
            raise

    @classmethod
    def dispatch_document_with_custom(cls, document_id: int, custom_name: str | None):
        """Dispatch using webhook from a given custom doc-type name (if configured)."""
        if not custom_name:
            return cls.dispatch_document(document_id)
        with get_session_sync() as session:
            doc = session.get(Document, document_id)
            if not doc:
                raise ValueError(f"Document {document_id} not found")
            doc_type_def = (
                session.query(CustomDocTypeDefinition)
                .filter(CustomDocTypeDefinition.tenant_id == doc.tenant_id)
                .filter(CustomDocTypeDefinition.name == custom_name)
                .first()
            )
            if not doc_type_def or not doc_type_def.destination_webhook:
                logger.warning(
                    f"No webhook configured for document {document_id} for custom '{custom_name}'"
                )
                return
            payload = {
                "document_id": doc.id,
                "document_type": custom_name,
                "state": doc.state.value,
                "data": doc.content,
            }
        try:
            cls._post(doc_type_def.destination_webhook, payload)
            logger.info(f"Webhook dispatch success for document {document_id} using custom '{custom_name}'")
        except RetryError as exc:
            logger.error(f"Failed to dispatch webhook after retries: {exc}")
            raise
