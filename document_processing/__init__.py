"""Document processing package.

This package exposes functions to classify and extract structured data from
documents. See ``doc_classifier``, ``doc_extractor`` and ``pipeline`` for more
details.
"""

from .doc_classifier import DocumentType, classify_document, get_instructions_for_type
from .doc_extractor import extract_fields
from .pipeline import run_pipeline

__all__ = [
    "DocumentType",
    "classify_document",
    "get_instructions_for_type",
    "extract_fields",
    "run_pipeline",
]
