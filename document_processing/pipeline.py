"""
pipeline
========

This module exposes a high‑level ``run_pipeline`` function that takes a
document (either as a file on disk or as bytes) and returns a
classification plus structured extraction results.  It orchestrates the
components from ``doc_classifier`` and ``doc_extractor`` without
requiring any knowledge of the underlying CrewAI implementation used in
the original example.

The pipeline works as follows:

1. Perform OCR on the document to extract text for classification.
2. Call the classifier to determine the document type and confidence.
3. Look up extraction instructions for the predicted type.
4. Run the LLM extractor on the text with the instructions.
5. Return a dictionary containing the classification and extraction
   results.

This function is used by the FastAPI service but can also be imported
directly into other Python code for programmatic use.

"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Dict, Optional, Union

from .doc_classifier import (
    classify_document,
    get_instructions_for_type,
    DocumentType,
    ClassificationResult,
)
from .doc_extractor import ocr_document, extract_fields
from .agents import (
    classify_with_agent,
    extract_with_agent,
    refine_extraction_with_agent,
)

__all__ = ["run_pipeline"]


def run_pipeline(
    file: Optional[bytes] = None,
    file_path: Optional[Union[str, Path]] = None,
    return_text: bool = False,
    forced_doc_type: Optional[str] = None,
    use_agents: bool = True,
    run_refine_pass: bool = True,
    ocr_fallback: bool = True,
) -> Dict:
    """Run the classification and extraction pipeline.

    Either ``file`` or ``file_path`` must be provided.  If ``file`` is
    provided it is written to a temporary file for processing.  The
    function performs OCR, classifies the text, retrieves extraction
    instructions, extracts fields, and returns the results.

    Args:
        file: Binary content of a document.  Mutually exclusive with
            ``file_path``.
        file_path: Path to a document on disk.  Mutually exclusive with
            ``file``.
        return_text: If true, include the raw OCR text in the response.
        forced_doc_type: If provided, bypass classification and use this type
            directly (e.g., "invoice").
        use_agents: If true, use CrewAI agents for classification/extraction;
            otherwise use direct LangChain implementations.
        run_refine_pass: If true, perform a refinement pass comparing the
            extracted JSON to the OCR text and instructions.
        ocr_fallback: If true and extraction fails, fall back to returning
            raw OCR text under data["raw_text"].

    Returns:
        A dictionary with keys:
            "classification": the classification result as dict.
            "data": the extracted fields (possibly empty).
            "raw_text": the OCR text if ``return_text`` is true.
    """
    if not file and not file_path:
        raise ValueError("Either 'file' or 'file_path' must be provided")

    # Write bytes to a temporary file if necessary
    if file is not None:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as tmp:
            tmp.write(file)
            tmp_path = Path(tmp.name)
    else:
        tmp_path = Path(file_path)

    # Step 1: OCR to get text for classification
    text = ocr_document(tmp_path)

    # Step 2: Classify the document (unless forced)
    if forced_doc_type:
        try:
            forced_enum = DocumentType(forced_doc_type)
        except Exception:
            forced_enum = DocumentType.OTHER
        classification: ClassificationResult = ClassificationResult(
            type=forced_enum, confidence=1.0
        )
    else:
        if use_agents:
            classification = classify_with_agent(text)
        else:
            classification = classify_document(text)

    # Step 3: Retrieve extraction instructions
    instructions = get_instructions_for_type(classification.type)

    # Step 4: Extract fields according to instructions
    if use_agents:
        data = extract_with_agent(text, instructions)
    else:
        data = extract_fields(text, instructions)

    # Optional refinement pass
    if run_refine_pass and use_agents and data:
        refined = refine_extraction_with_agent(text, data, instructions)
        if isinstance(refined, dict) and refined:
            data = refined

    # OCR fallback if extraction failed
    if ocr_fallback and (not isinstance(data, dict) or not data):
        data = {"raw_text": text[:1000] if text else ""}

    result = {
        "classification": classification.dict(),
        "data": data,
    }
    if return_text:
        result["raw_text"] = text

    # Clean up temporary file if we created one
    if file is not None:
        try:
            tmp_path.unlink()
        except Exception:
            pass

    return result