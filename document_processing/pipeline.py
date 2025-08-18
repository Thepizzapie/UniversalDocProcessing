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
    classify_with_agent,
    extract_with_agent,
    identify_profile_with_agent,
    refine_extraction_with_agent,
)
from .config import validate_config
from .doc_classifier import (
    ClassificationResult,
    DocumentType,
    classify_document,
    classify_document_from_image,
    classify_document_openai,
    get_instructions_for_type,
)
from .doc_extractor import extract_fields, extract_fields_from_image

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

    errors = []

    # Step 1: No OCR – AI-only pipeline
    text = ""

    # Step 2: Identify profile (Agent 1) and classify (Agent 2) unless forced
    if forced_doc_type:
        try:
            forced_enum = DocumentType(forced_doc_type)
        except Exception:
            # Prefer a neutral fallback instead of assuming receipt
            forced_enum = DocumentType.OTHER
        classification: ClassificationResult = ClassificationResult(
            type=forced_enum, confidence=1.0
        )
    else:
        # Identify a profile first (currently unused but may be used in future)
        try:
            identify_profile_with_agent(text or "") if use_agents else {}
        except Exception:
            pass

        # Classify using OCR text / profile.
        try:
            if use_agents:
                if text:
                    classification = classify_with_agent(text)
                else:
                    # No text → classify directly from image using vision
                    classification = classify_document_from_image(str(tmp_path))
            else:
                # If no OCR text, try image-based classification first
                if not text and tmp_path.exists():
                    classification = classify_document_from_image(str(tmp_path))
                else:
                    # For gpt-5, prefer direct OpenAI client to avoid LangChain max_tokens usage
                    from .config import get_config as _gc

                    if (_gc().model_name or "").lower() == "gpt-5":
                        classification = classify_document_openai(text or "")
                    else:
                        classification = classify_document(text or "")
            logger.info(
                "pipeline: classified document as %s (conf=%.3f)",
                classification.type.value,
                classification.confidence,
            )
            # If OCR text is empty, lower confidence
            if not text:
                classification.confidence = min(classification.confidence, 0.2)
        except Exception as err:
            logger.exception("pipeline: classification failed: %s", err)
            errors.append(f"classification_failed: {err}")
            classification = ClassificationResult(type=DocumentType.OTHER, confidence=0.0)
    logger.info(
        "pipeline:finished step=classify type=%s conf=%.3f",
        classification.type.value,
        classification.confidence,
    )

    # Step 3: Retrieve extraction instructions
    instructions = get_instructions_for_type(classification.type)

    # Helper to decide if JSON has meaningful values
    def _is_meaningful(d: Dict) -> bool:
        if not isinstance(d, dict) or not d:
            return False
        for v in d.values():
            if v is None:
                continue
            if isinstance(v, str) and v.strip() == "":
                continue
            if isinstance(v, (list, tuple, set)) and len(v) == 0:
                continue
            # Numbers (including 0) and non-empty strings/lists count as meaningful
            return True
        return False

    data = {}
    # If OCR text is empty, go straight to vision extraction
    if not text and tmp_path.exists():
        try:
            logger.info("pipeline: no OCR text; using vision extraction for %s", tmp_path.name)
            vision_data = extract_fields_from_image(tmp_path, instructions)
            if isinstance(vision_data, dict) and vision_data:
                data = vision_data
                logger.info(
                    "pipeline: vision fallback succeeded with %d fields",
                    len(vision_data),
                )
            else:
                logger.warning("pipeline: vision extraction returned no data")
        except Exception as vision_err:
            logger.exception("pipeline: vision fallback failed: %s", vision_err)
            errors.append(f"vision_fallback_failed: {vision_err}")
    else:
        # Try text extraction first
        try:
            if use_agents:
                data = extract_with_agent(text or "", instructions)
            else:
                data = extract_fields(text or "", instructions)
            logger.info(
                "pipeline: text extraction returned %d fields: %s",
                len(data) if isinstance(data, dict) else -1,
                list(data.keys()) if isinstance(data, dict) and data else "none",
            )
        except Exception as err:
            logger.exception("pipeline: text extraction failed: %s", err)
            data = {}
            errors.append(f"extraction_failed: {err}")

        # Vision fallback when extracted JSON has no meaningful values
        if not _is_meaningful(data) and tmp_path.exists():
            try:
                logger.info("pipeline: falling back to vision extraction for %s", tmp_path.name)
                vision_data = extract_fields_from_image(tmp_path, instructions)
                if isinstance(vision_data, dict) and _is_meaningful(vision_data):
                    data = vision_data
                    logger.info(
                        "pipeline: vision fallback succeeded with %d fields",
                        len(vision_data),
                    )
                else:
                    logger.warning("pipeline: vision fallback returned no meaningful data")
            except Exception as vision_err:
                logger.exception("pipeline: vision fallback failed: %s", vision_err)
                errors.append(f"vision_fallback_failed: {vision_err}")
    logger.info("pipeline:finished step=extract has_data=%s", _is_meaningful(data))

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
    if errors:
        result["errors"] = errors

    # Clean up temporary file if we created one
    if file is not None:
        try:
            tmp_path.unlink()
        except Exception:
            pass

    return result
