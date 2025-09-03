"""Simple document classifier used by the MVP pipeline.

The classifier is intentionally lightweight: it uses a few keyword
heuristics to determine whether a document looks like an invoice or a
receipt and falls back to `OTHER` otherwise.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
import json
from typing import Iterable, Optional


class DocumentType(str, Enum):
    """Supported document types."""

    INVOICE = "invoice"
    RECEIPT = "receipt"
    OTHER = "other"


@dataclass
class ClassificationResult:
    """Result returned by :func:`classify_document`."""

    type: DocumentType
    confidence: float


def classify_document(
    text: str,
    allowed_types: Optional[Iterable[DocumentType]] = None,
    model: Optional[object] = None,
) -> ClassificationResult:
    """Classify ``text`` into a :class:`DocumentType`.

    If a ``model`` is supplied it is expected to expose an ``invoke`` method
    returning an object with a ``content`` attribute containing JSON of the
    form ``{"type": "invoice", "confidence": 0.9}``.  This mirrors the
    behaviour of real LLM clients while keeping the implementation extremely
    small.  When no model is provided the function falls back to simple
    keyword heuristics.
    """

    if allowed_types is None:
        allowed_types = list(DocumentType)
    else:
        allowed_types = list(allowed_types)

    if model is not None:
        try:
            response = model.invoke(text)
            payload = json.loads(getattr(response, "content", "{}"))
            doc_type = DocumentType(payload.get("type", "other"))
            if doc_type not in allowed_types:
                doc_type = DocumentType.OTHER
            confidence = float(payload.get("confidence", 0.0))
            return ClassificationResult(doc_type, confidence)
        except Exception:
            # fall back to heuristic classifier below
            pass

    text_l = (text or "").lower()
    doc_type = DocumentType.OTHER
    if DocumentType.INVOICE in allowed_types and "invoice" in text_l:
        doc_type = DocumentType.INVOICE
    elif DocumentType.RECEIPT in allowed_types and "receipt" in text_l:
        doc_type = DocumentType.RECEIPT

    confidence = 0.9 if doc_type is not DocumentType.OTHER else 0.0
    return ClassificationResult(type=doc_type, confidence=confidence)


_INSTRUCTIONS = {
    DocumentType.INVOICE: "Extract fields: invoice_number and total",
    DocumentType.RECEIPT: "Extract fields: total",
    DocumentType.OTHER: "",
}


def get_instructions_for_type(doc_type: DocumentType) -> str:
    """Return extraction instructions for ``doc_type``."""

    return _INSTRUCTIONS.get(doc_type, "")
