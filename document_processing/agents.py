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
from typing import Any, Dict, List, Optional

from langchain_openai import ChatOpenAI

from .config import get_config

try:
    # CrewAI is optional at runtime; code should still work without it
    from crewai import Agent, Crew, Task

    _CREWAI_AVAILABLE = True
except Exception:
    _CREWAI_AVAILABLE = False

from .doc_classifier import (
    ClassificationResult,
    DocumentType,
)
from .doc_classifier import (
    classify_document as lc_classify_document,
)
from .doc_extractor import extract_fields as lc_extract_fields

__all__ = [
    "classify_with_agent",
    "extract_with_agent",
    "refine_extraction_with_agent",
    "identify_profile_with_agent",
]


def _default_llm(temperature: float = 1.0, max_tokens: int = 1024) -> ChatOpenAI:
    config = get_config()
    # GPT-5 uses max_completion_tokens, and requires default temperature (1)
    if (config.model_name or "").lower() == "gpt-5":
        return ChatOpenAI(
            openai_api_key=config.openai_api_key,
            openai_api_base=config.openai_api_base,
            model_name=config.model_name,
            temperature=1.0,
            max_completion_tokens=max_tokens,
        )
    return ChatOpenAI(
        openai_api_key=config.openai_api_key,
        openai_api_base=config.openai_api_base,
        model_name=config.model_name,
        temperature=temperature,
        max_tokens=max_tokens,
    )


def identify_profile_with_agent(text: str) -> Dict[str, Any]:
    """Agent 1: Identify document and output a JSON profile from text.

    The profile should summarize structure and likely fields. Falls back to
    a minimal profile if agent execution fails.
    """
    if not _CREWAI_AVAILABLE:
        # Minimal heuristic profile when CrewAI is unavailable
        return {
            "type_hint": "other" if not text else "unknown",
            "likely_fields": [],
            "confidence_hints": [],
        }

    llm = _default_llm(temperature=1.0, max_tokens=600)

    identifier = Agent(
        role="Document Identifier",
        goal=(
            "Analyze OCR text and produce a compact JSON profile describing the document type,"
            " likely fields present, and structural hints."
        ),
        backstory=(
            "You examine business documents and summarize their structure. "
            "Output strictly valid JSON."
        ),
        llm=llm,
        allow_delegation=False,
        verbose=False,
    )

    task = Task(
        description=(
            "Given the following OCR text, output a JSON object with keys:"
            " type_hint, likely_fields, confidence_hints.\n"
            f"OCR text:\n{text[:3000]}"
        ),
        expected_output=(
            '{"type_hint": "...", "likely_fields": ["..."], "confidence_hints": ["..."]}'
        ),
        agent=identifier,
    )

    try:
        crew = Crew(agents=[identifier], tasks=[task])
        result = crew.kickoff()
        content = str(result).strip()
        return json.loads(content)
    except Exception:
        return {"type_hint": "other", "likely_fields": [], "confidence_hints": []}


def classify_with_agent(
    text: str, allowed_types: Optional[List[DocumentType]] = None
) -> ClassificationResult:
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

    llm = _default_llm(temperature=1.0, max_tokens=300)

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
            f"Allowed types: {allowed_names}.\n"
            f"Document OCR text:\n{text}\n\n"
            "Respond with JSON only, using this schema: "
            '{"type": "<one of the allowed types>", "confidence": <float 0-1>}'
        ),
        expected_output=('{"type": "<type>", "confidence": <float>}'),
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


def extract_with_agent(
    text: str, instructions: str, max_output_chars: int = 3000
) -> Dict[str, Any]:
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

    llm = _default_llm(temperature=1.0, max_tokens=1200)

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

    truncated_text = text[:max_output_chars]

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

    llm = _default_llm(temperature=1.0, max_tokens=1200)

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

    truncated_text = text[:max_output_chars]

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
