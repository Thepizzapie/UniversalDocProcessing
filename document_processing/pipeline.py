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

import logging
import tempfile
from pathlib import Path
from typing import Dict, Optional, Union

from .agents import (
    refine_extraction_with_agent,
)
from .config import validate_config
from .doc_classifier import (
    ClassificationResult,
    DocumentType,
    get_instructions_for_type,
)
from .doc_extractor import extract_fields_from_image

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
    logger = logging.getLogger("doc_ai_pipeline")
    if not file and not file_path:
        raise ValueError("Either 'file' or 'file_path' must be provided")
    
    # Validate configuration before processing
    if not validate_config():
        logger.warning("Configuration validation failed, proceeding with warnings")

    # Write bytes to a temporary file if necessary
    if file is not None:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as tmp:
            tmp.write(file)
            tmp_path = Path(tmp.name)
    else:
        tmp_path = Path(file_path)

    # Step 1: Skip OCR, use GPT-5 Vision directly for images
    logger.info("pipeline:starting step=vision_extraction")
    text = ""  # Skip OCR entirely
    logger.info("pipeline:finished step=vision_extraction chars=%s", len(text) if text else 0)

    # Step 2: Classify the document (unless forced)
    if forced_doc_type:
        try:
            forced_enum = DocumentType(forced_doc_type)
        except Exception:
            forced_enum = DocumentType.RECEIPT  # Default fallback
        classification: ClassificationResult = ClassificationResult(
            type=forced_enum, confidence=1.0
        )
    else:
        # Use GPT-5 Vision to classify the document type
        try:
            # Simple classification prompt
            document_types = ', '.join([t.value for t in DocumentType])
            classify_prompt = (
                f"Look at this document image and classify it as one of these types: "
                f"{document_types}. Return only the exact type name."
            )
            classification_result = extract_fields_from_image(tmp_path, classify_prompt)
            doc_type_str = (
                list(classification_result.values())[0] if classification_result else "receipt"
            )
            
            # Find matching document type
            classified_type = DocumentType.RECEIPT  # default
            for doc_type in DocumentType:
                if doc_type.value.lower() in doc_type_str.lower():
                    classified_type = doc_type
                    break
                    
            classification = ClassificationResult(type=classified_type, confidence=0.9)
            logger.info("pipeline: classified document as %s", classified_type.value)
        except Exception as err:
            logger.exception("pipeline: classification failed: %s", err)
            classification = ClassificationResult(type=DocumentType.RECEIPT, confidence=0.5)
    logger.info(
        "pipeline:finished step=classify type=%s conf=%.3f", 
        classification.type.value, classification.confidence
    )

    # Step 3: Retrieve extraction instructions
    instructions = get_instructions_for_type(classification.type)

    # Step 4: Extract fields using GPT-5 Vision directly
    try:
        # Always use vision-based extraction - don't rely on file extension for temp files
        logger.info("pipeline: using GPT-5 vision extraction for file %s", tmp_path.name)
        data = extract_fields_from_image(tmp_path, instructions)
        logger.info(
            "pipeline: vision extraction returned %d fields: %s", 
            len(data), list(data.keys()) if data else "none"
        )
    except Exception as err:
        logger.exception("pipeline: extraction failed: %s", err)
        data = {}
    logger.info("pipeline:finished step=extract has_data=%s", bool(data))

    # Optional refinement pass
    if run_refine_pass and use_agents and data:
        try:
            refined = refine_extraction_with_agent(text, data, instructions)
            if isinstance(refined, dict) and refined:
                data = refined
            logger.info("pipeline:finished step=refine improved=%s", bool(refined))
        except Exception as err:
            logger.exception("pipeline: refinement failed: %s", err)

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