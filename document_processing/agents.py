"""Simplified agent helpers used in tests.

The original project integrated CrewAI and other LLM frameworks.  For the
MVP backend we provide very small wrappers that fall back to the
lightweight classifier and extractor functions.  This keeps dependencies to a
minimum while preserving a compatible API surface.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .doc_classifier import ClassificationResult, DocumentType, classify_document
from .doc_extractor import extract_fields

__all__ = [
    "classify_with_agent",
    "extract_with_agent",
    "refine_extraction_with_agent",
    "identify_profile_with_agent",
]


def classify_with_agent(text: str, allowed_types: Optional[list[DocumentType]] = None) -> ClassificationResult:
    """Delegate to :func:`classify_document`.

    In a full implementation this would orchestrate an AI agent.  For the MVP
    we simply reuse the heuristic classifier.
    """
    return classify_document(text, allowed_types=allowed_types)


def extract_with_agent(text: str, instructions: str, max_output_chars: int = 3000) -> Dict[str, Any]:
    """Delegate to :func:`extract_fields`.

    Parameters are kept for API compatibility even though they are unused by
    the minimalist implementation.
    """
    del max_output_chars
    return extract_fields(text, instructions)


def refine_extraction_with_agent(text: str, extracted: Dict[str, Any]) -> Dict[str, Any]:
    """Return ``extracted`` unmodified.

    The real system might compare the extracted data against the source text to
    correct errors.  The MVP keeps the interface without additional logic.
    """
    del text  # unused
    return extracted


def identify_profile_with_agent(text: str) -> Dict[str, Any]:
    """Return a minimal profile for ``text``."""
    return {"type_hint": "other" if not text else "unknown"}
