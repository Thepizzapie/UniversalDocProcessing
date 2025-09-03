"""Lightweight document processing package.

This package provides a minimal set of utilities for classifying documents,
extracting structured fields and running a small end-to-end pipeline.  It is
intentionally simple to serve as an MVP backend that can be expanded upon.
"""

from .doc_classifier import (
    ClassificationResult,
    DocumentType,
    classify_document,
    get_instructions_for_type,
)
from .doc_extractor import extract_fields, extract_fields_from_image
from .pipeline import run_pipeline

__all__ = [
    "ClassificationResult",
    "DocumentType",
    "classify_document",
    "get_instructions_for_type",
    "extract_fields",
    "extract_fields_from_image",
    "run_pipeline",
]
