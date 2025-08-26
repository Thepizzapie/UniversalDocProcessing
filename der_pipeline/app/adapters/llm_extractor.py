"""LLM extraction interface and implementations."""

import json
from typing import Any

import openai
from loguru import logger

from ..config import settings


def extract_fields(text: str, doc_type: str, model: str | None = None) -> dict[str, Any]:
    """Extract fields using OpenAI API.

    Args:
        text: Document text to extract from
        doc_type: Type of document (invoice, receipt, etc.)
        model: OpenAI model to use (defaults to settings.llm_model)

    Returns:
        Dict mapping field names to {value, confidence} dicts
    """
    if not settings.openai_api_key:
        logger.warning("OpenAI API key not configured, returning empty extraction")
        return {}

    model = model or settings.llm_model

    # Configure OpenAI client
    client = openai.OpenAI(api_key=settings.openai_api_key)

    # Create document type specific prompts
    prompts = {
        "invoice": _get_invoice_prompt(),
        "receipt": _get_receipt_prompt(),
        "entry_exit_log": _get_entry_exit_log_prompt(),
        "unknown": _get_generic_prompt(),
    }

    system_prompt = prompts.get(doc_type.lower(), prompts["unknown"])

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Extract fields from this document:\n\n{text}"},
            ],
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
        )

        # Parse the JSON response
        content = response.choices[0].message.content
        extracted_data = json.loads(content)

        # Ensure each field has value and confidence
        result = {}
        for field, data in extracted_data.items():
            if isinstance(data, dict) and "value" in data:
                result[field] = {"value": data["value"], "confidence": data.get("confidence", 0.8)}
        else:
                # Handle simple value format
                result[field] = {"value": data, "confidence": 0.8}

        return result

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {e}")
        return {}
    except Exception as e:
        logger.error(f"LLM extraction failed: {e}")
        return {}


def _get_invoice_prompt() -> str:
    """Get system prompt for invoice extraction."""
    return """You are an expert at extracting structured data from invoices.
Extract the following fields and return as JSON:

{
  "invoice_number": {"value": "...", "confidence": 0.9},
  "vendor_name": {"value": "...", "confidence": 0.9},
  "vendor_address": {"value": "...", "confidence": 0.8},
  "vendor_tax_id": {"value": "...", "confidence": 0.8},
  "invoice_date": {"value": "YYYY-MM-DD", "confidence": 0.9},
  "due_date": {"value": "YYYY-MM-DD", "confidence": 0.8},
  "subtotal": {"value": 100.00, "confidence": 0.9},
  "tax_amount": {"value": 10.00, "confidence": 0.8},
  "total_amount": {"value": 110.00, "confidence": 0.9},
  "currency": {"value": "USD", "confidence": 0.9},
  "payment_terms": {"value": "...", "confidence": 0.7}
}

Use null for missing fields. Confidence should be 0.0-1.0 based on how certain you are."""


def _get_receipt_prompt() -> str:
    """Get system prompt for receipt extraction."""
    return """You are an expert at extracting structured data from receipts.
Extract the following fields and return as JSON:

{
  "merchant_name": {"value": "...", "confidence": 0.9},
  "merchant_address": {"value": "...", "confidence": 0.8},
  "transaction_date": {"value": "YYYY-MM-DD", "confidence": 0.9},
  "transaction_time": {"value": "HH:MM:SS", "confidence": 0.8},
  "total_amount": {"value": 25.50, "confidence": 0.9},
  "tax_amount": {"value": 2.30, "confidence": 0.8},
  "currency": {"value": "USD", "confidence": 0.9},
  "payment_method": {"value": "...", "confidence": 0.8},
  "receipt_number": {"value": "...", "confidence": 0.8}
}

Use null for missing fields. Confidence should be 0.0-1.0 based on how certain you are."""


def _get_entry_exit_log_prompt() -> str:
    """Get system prompt for entry/exit log extraction."""
    return """You are an expert at extracting structured data from entry/exit logs.
Extract the following fields and return as JSON:

{
  "person_name": {"value": "...", "confidence": 0.9},
  "person_id": {"value": "...", "confidence": 0.8},
  "entry_time": {"value": "YYYY-MM-DD HH:MM:SS", "confidence": 0.9},
  "exit_time": {"value": "YYYY-MM-DD HH:MM:SS", "confidence": 0.9},
  "location": {"value": "...", "confidence": 0.9},
  "purpose": {"value": "...", "confidence": 0.7},
  "authorized_by": {"value": "...", "confidence": 0.8},
  "badge_number": {"value": "...", "confidence": 0.8},
  "vehicle_info": {"value": "...", "confidence": 0.7}
}

Use null for missing fields. Confidence should be 0.0-1.0 based on how certain you are."""


def _get_generic_prompt() -> str:
    """Get system prompt for generic document extraction."""
    return """You are an expert at extracting structured data from documents.
Analyze the document and extract relevant key-value pairs as JSON:

{
  "field_name": {"value": "...", "confidence": 0.8},
  "another_field": {"value": "...", "confidence": 0.9}
}

Extract fields that seem relevant based on the document content.
Use descriptive field names. Confidence should be 0.0-1.0 based on how certain you are."""
