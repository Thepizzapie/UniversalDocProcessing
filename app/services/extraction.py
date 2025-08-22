from __future__ import annotations


from .. import models
from ..schemas import ExtractedRecord
from ..adapters import llm_extractor, ocr_provider


def extract(document: models.Document, content: bytes) -> ExtractedRecord:
    """Extract fields from document content."""
    text = ocr_provider.extract_text(content)
    return llm_extractor.extract_fields(text)
