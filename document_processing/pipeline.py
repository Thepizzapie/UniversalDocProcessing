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

import json
import logging
import tempfile
import time
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
    get_instructions_for_type,
)
from .doc_extractor import extract_fields, extract_fields_from_image


def get_vector_db_connector(config):
    if config.vector_db_provider == "pgvector":
        # TODO: Add PGVector connector
        return None
    elif config.vector_db_provider == "chromadb":
        # TODO: Add ChromaDB connector
        return None
    elif config.vector_db_provider == "weaviate":
        # TODO: Add Weaviate connector
        return None
    else:
        raise ValueError(f"Unknown vector DB provider: {config.vector_db_provider}")


def get_embedding_model(config):
    if config.embedding_provider == "openai":
        # TODO: Add OpenAI embedding model
        return None
    elif config.embedding_provider == "huggingface":
        # TODO: Add HuggingFace embedding model
        return None
    elif config.embedding_provider == "ollama":
        # TODO: Add Ollama embedding model
        return None
    else:
        raise ValueError(f"Unknown embedding provider: {config.embedding_provider}")


def get_text_extractor(config):
    if config.text_extractor_provider == "llmwhisperer":
        # TODO: Add LLMWhisperer extractor
        return None
    elif config.text_extractor_provider == "unstructured":
        # TODO: Add Unstructured.io extractor
        return None
    elif config.text_extractor_provider == "llamaparse":
        # TODO: Add LlamaParse extractor
        return None
    else:
        raise ValueError(f"Unknown text extractor provider: {config.text_extractor_provider}")


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

    def json_log(message: str, **kwargs):
        """Log messages in JSON format."""
        logger.info(json.dumps({"message": message, **kwargs}))

    json_log("pipeline:start processing document", step="start")
    start_time = time.time()

    # Step 1: No OCR – AI-only pipeline
    text = ""

    # Agent 1: Identify profile
    profile = None
    try:
        profile = identify_profile_with_agent(text or "") if use_agents else {}
        json_log("pipeline:identified profile", profile=profile)
    except Exception as err:
        logger.exception("pipeline: profile identification failed: %s", err)
        errors.append({"code": "E_PROFILE_FAILED", "message": str(err)})
        profile = {}

    # Agent 2: Classifier matches profile to doc_types.json
    classification = None
    matched_type = None
    if forced_doc_type:
        try:
            forced_enum = DocumentType(forced_doc_type)
        except Exception:
            forced_enum = DocumentType.OTHER
        classification = ClassificationResult(type=forced_enum, confidence=1.0)
        matched_type = forced_enum
    else:
        try:
            # Compare profile to doc_types.json
            # Find best match (simple string match for now, can be improved)
            config_types = [dt for dt in DocumentType]
            best_match = DocumentType.OTHER
            for dt in config_types:
                if profile and dt.value in json.dumps(profile).lower():
                    best_match = dt
                    break
            matched_type = best_match
            # Use agent classifier to confirm
            classification = (
                classify_with_agent(json.dumps(profile))
                if use_agents
                else ClassificationResult(type=matched_type, confidence=1.0)
            )
            logger.info(
                "pipeline: classified document as %s (conf=%.3f)",
                classification.type.value,
                classification.confidence,
            )
        except Exception as err:
            logger.exception("pipeline: classification failed: %s", err)
            errors.append({"code": "E_CLASSIFICATION_FAILED", "message": str(err)})
            classification = ClassificationResult(type=DocumentType.OTHER, confidence=0.0)
            matched_type = DocumentType.OTHER
    logger.info(
        "pipeline:finished step=classify type=%s conf=%.3f",
        classification.type.value,
        classification.confidence,
    )

    # Agent 3: Extractor uses instructions for matched type
    instructions = get_instructions_for_type(matched_type)

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
            errors.append({"code": "E_VISION_FALLBACK_FAILED", "message": str(vision_err)})
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
            errors.append({"code": "E_EXTRACTION_FAILED", "message": str(err)})

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
                errors.append({"code": "E_VISION_FALLBACK_FAILED", "message": str(vision_err)})
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

    # Build structured result with clearer error semantics
    result = {
        "classification": classification.dict(),
        "data": data,
    }
    if classification.confidence == 0.0 and not _is_meaningful(data):
        # Provide explicit failure code for clients
        result.setdefault("errors", []).append(
            {
                "code": "E_NO_CONFIDENCE_NO_DATA",
                "message": ("Classification confidence is zero and no fields were " "extracted"),
            }
        )
        result.setdefault(
            "message",
            ("Classification confidence is zero and no fields were " "extracted"),
        )
    if return_text:
        result["raw_text"] = text
    if errors:
        result["errors"] = errors

    end_time = time.time()
    processing_time = end_time - start_time
    json_log("pipeline:end processing document", step="end", processing_time=processing_time)

    # Clean up temporary file if we created one
    if file is not None:
        try:
            tmp_path.unlink()
        except Exception:
            pass

    return result


def post_extraction_hook(data: dict) -> dict:
    """Example hook for custom business logic after extraction."""
    # Example: Map fields to database models
    mapped_data = {key.upper(): value for key, value in data.items()}
    return mapped_data
