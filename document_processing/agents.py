"""
agents
======

CrewAI-based agents for document classification and extraction.

This module defines thin wrappers around CrewAI agents to:

1) Classify document OCR text into a known type defined in
   ``config/doc_types.yaml``.
2) Extract structured fields according to type-specific instructions.

These helpers gracefully fall back to the existing LangChain-only
implementations in ``doc_classifier`` and ``doc_extractor`` if CrewAI
execution fails for any reason, ensuring robustness in production.
"""

from __future__ import annotations

import json
import os
from typing import List, Optional, Dict, Any

from langchain_openai import ChatOpenAI

try:
    # CrewAI is optional at runtime; code should still work without it
    from crewai import Agent, Task, Crew

    _CREWAI_AVAILABLE = True
except Exception:
    _CREWAI_AVAILABLE = False

from .doc_classifier import (
    DocumentType,
    ClassificationResult,
    classify_document as lc_classify_document,
)
from .doc_extractor import extract_fields as lc_extract_fields

__all__ = [
    "classify_with_agent",
    "extract_with_agent",
    "refine_extraction_with_agent",
]


def _default_llm(temperature: float = 0.0, max_tokens: int = 1024) -> ChatOpenAI:
    return ChatOpenAI(
        openai_api_key=os.environ.get("OPENAI_API_KEY"),
        openai_api_base=os.environ.get("OPENAI_API_BASE_URL", "https://api.openai.com/v1"),
        temperature=temperature,
        model_name=os.environ.get("MODEL_NAME", "gpt-4o-mini"),
        max_tokens=max_tokens,
    )


def classify_with_agent(text: str, allowed_types: Optional[List[DocumentType]] = None) -> ClassificationResult:
    """Classify document text using a CrewAI agent, with fallback to LangChain.

    Args:
        text: OCR text of the document.
        allowed_types: Optional subset of types. Defaults to all.

    Returns:
        ClassificationResult
    """
    if not _CREWAI_AVAILABLE:
        return lc_classify_document(text, allowed_types=allowed_types)

    if allowed_types is None:
        allowed_types = list(DocumentType)
    allowed_names = ", ".join([dt.value for dt in allowed_types])

    llm = _default_llm(temperature=0.1, max_tokens=256)

    classifier = Agent(
        role="Document Classifier",
        goal="Classify OCR text into a known document type and estimate confidence.",
        backstory=(
            "You specialize in categorizing documents. You must choose exactly one type "
            "from the allowed list and output strict JSON with 'type' and 'confidence'."
        ),
        llm=llm,
        allow_delegation=False,
        verbose=False,
    )

    task = Task(
        description=(
            "Allowed types: {allowed}.\n"
            "Document OCR text:\n{text}\n\n"
            "Respond with JSON only, using this schema: "
            "{\"type\": <one of the allowed types>, \"confidence\": <float 0-1>}"
        ).format(allowed=allowed_names, text=text),
        expected_output=(
            '{"type": "<type>", "confidence": <float>}'
        ),
        agent=classifier,
    )

    try:
        crew = Crew(agents=[classifier], tasks=[task])
        result = crew.kickoff()
        content = str(result).strip()
        data = json.loads(content)
        return ClassificationResult.parse_obj(data)
    except Exception:
        # Fallback to the LangChain-only implementation
        return lc_classify_document(text, allowed_types=allowed_types)


def extract_with_agent(text: str, instructions: str, max_output_chars: int = 3000) -> Dict[str, Any]:
    """Extract structured fields using a CrewAI agent, with fallback to LangChain.

    Args:
        text: OCR text to extract from.
        instructions: Type-specific extraction instructions.
        max_output_chars: Truncation length for text to control prompt size.

    Returns:
        Dictionary of extracted fields.
    """
    if not _CREWAI_AVAILABLE:
        return lc_extract_fields(text, instructions, max_output_chars=max_output_chars)

    llm = _default_llm(temperature=0.0, max_tokens=2048)

    extractor = Agent(
        role="Information Extraction Specialist",
        goal="Produce a strictly valid JSON object following the provided instructions.",
        backstory=(
            "You extract structured data from noisy OCR text. You never add commentary, "
            "you only return valid JSON with the expected schema."
        ),
        llm=llm,
        allow_delegation=False,
        verbose=False,
    )

    truncated_text = text[: max_output_chars]

    task = Task(
        description=(
            "Instructions:\n{instructions}\n\nDocument text:\n{text}\n\n"
            "Return only a valid JSON object that follows the instructions."
        ).format(instructions=instructions, text=truncated_text),
        expected_output="A valid JSON object only",
        agent=extractor,
    )

    try:
        crew = Crew(agents=[extractor], tasks=[task])
        result = crew.kickoff()
        content = str(result).strip()
        return json.loads(content)
    except Exception:
        # Fallback to the LangChain-only implementation
        return lc_extract_fields(text, instructions, max_output_chars=max_output_chars)


def refine_extraction_with_agent(
    text: str,
    current_data: Dict[str, Any],
    instructions: str,
    max_output_chars: int = 3000,
) -> Dict[str, Any]:
    """Refine previously extracted data by comparing against OCR text.

    The agent is asked to validate and correct the current JSON according to
    the instructions and the provided OCR text. If anything fails, the
    original ``current_data`` is returned unchanged.

    Args:
        text: OCR text of the document.
        current_data: The JSON object produced by the first extraction pass.
        instructions: Extraction instructions for the detected document type.
        max_output_chars: Truncation length for text.

    Returns:
        Refined JSON object. Falls back to the original ``current_data`` on error.
    """
    if not _CREWAI_AVAILABLE:
        # Without CrewAI we simply return what we have
        return current_data

    llm = _default_llm(temperature=0.0, max_tokens=2048)

    refiner = Agent(
        role="Extraction Refiner",
        goal=(
            "Validate and correct the extracted JSON so it matches the document text "
            "and the instructions. Output strictly valid JSON with the same schema."
        ),
        backstory=(
            "You are meticulous about data correctness. If a field is missing or wrong, "
            "fix it using the OCR text. Keep field names unchanged."
        ),
        llm=llm,
        allow_delegation=False,
        verbose=False,
    )

    truncated_text = text[: max_output_chars]

    task = Task(
        description=(
            "Instructions (schema to follow):\n{instructions}\n\n"
            "OCR text:\n{text}\n\n"
            "Current extracted JSON (correct and return the improved JSON only):\n{data}"
        ).format(instructions=instructions, text=truncated_text, data=json.dumps(current_data)),
        expected_output="A valid JSON object only",
        agent=refiner,
    )

    try:
        crew = Crew(agents=[refiner], tasks=[task])
        result = crew.kickoff()
        content = str(result).strip()
        return json.loads(content)
    except Exception:
        return current_data


