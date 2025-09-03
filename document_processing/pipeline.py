"""End-to-end document processing pipeline.

The pipeline wires together the simple classifier and extractor to provide a
single function, :func:`run_pipeline`, which accepts either a path to a file or
raw bytes.  Heavy dependencies such as OCR or vector databases are deliberately
omitted to keep the MVP fast and easy to understand.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Optional, Union

from .config import validate_config
from .doc_classifier import ClassificationResult, DocumentType, classify_document, get_instructions_for_type
from .doc_extractor import extract_fields

__all__ = ["run_pipeline"]


def _read_text(file: Optional[bytes], file_path: Optional[Union[str, Path]]) -> str:
    if file is not None:
        try:
            return file.decode("utf-8", errors="ignore")
        except Exception:  # pragma: no cover - unexpected encoding issues
            return ""
    if file_path is not None:
        try:
            return Path(file_path).read_text()
        except Exception:
            return ""
    return ""


def run_pipeline(
    file: Optional[bytes] = None,
    file_path: Optional[Union[str, Path]] = None,
    return_text: bool = False,
    forced_doc_type: Optional[str] = None,
    use_agents: bool = False,
    run_refine_pass: bool = False,
    ocr_fallback: bool = True,
) -> Dict[str, Dict]:
    """Process a document and return classification and extraction results.

    The function performs only minimal work but mimics the interface of the
    earlier, far more complex pipeline.  It validates configuration, runs the
    heuristic classifier and extraction routines, and optionally includes the
    raw text in the output.
    """

    if file is None and file_path is None:
        raise ValueError("Either 'file' or 'file_path' must be provided")

    # Configuration validation is best-effort; failures simply result in False
    try:
        validate_config()
    except Exception:  # pragma: no cover - validation errors are logged
        pass

    text = _read_text(file, file_path)

    if forced_doc_type:
        try:
            doc_type = DocumentType(forced_doc_type)
        except Exception:
            doc_type = DocumentType.OTHER
        classification = ClassificationResult(doc_type, 1.0)
    else:
        classification = classify_document(text)

    instructions = get_instructions_for_type(classification.type)
    data = extract_fields(text, instructions) if instructions else {}

    if (return_text or ocr_fallback) and "raw_text" not in data:
        data["raw_text"] = text

    return {
        "classification": {"type": classification.type, "confidence": classification.confidence},
        "data": data,
    }
