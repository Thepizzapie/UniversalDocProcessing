"""
doc_classifier
==============

This module provides a function to classify a piece of text into one of
several predefined document types.  It leverages a large language model
from OpenAI via LangChain to perform the classification, returning both
the predicted type and a confidence score.  The available document types
and their extraction instructions are defined in ``config/doc_types.yaml``.

The classifier exposes two utilities:

* ``load_doc_types`` reads the YAML configuration file and returns a
  mapping of document type keys to descriptions and instructions.
* ``classify_document`` sends the document text to an LLM and asks it to
  choose the most appropriate type from the allowed list.  The result is
  parsed into a ``ClassificationResult`` Pydantic model.

By constraining the model’s output to a finite set of types we reduce
hallucinations and make downstream processing more robust.  Tagging and
classification are common NLP tasks used to label text with
categories such as sentiment, language or topic【836420910606368†L280-L297】.

Dependencies:
  ``pydantic``, ``langchain-openai``.  Make sure to set the
  ``OPENAI_API_KEY`` environment variable before calling
  ``classify_document``.

"""

from __future__ import annotations

import json
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from .config import get_config

__all__ = [
    "DocumentType",
    "ClassificationResult",
    "load_doc_types",
    "get_instructions_for_type",
    "classify_document",
]


class DocumentType(str, Enum):
    """Enumeration of supported document types.  The member names must
    match the keys defined in ``doc_types.yaml``.
    """

    INVOICE = "invoice"
    RECEIPT = "receipt"
    LOAD_SHEET = "load_sheet"
    OTHER = "other"


class ClassificationResult(BaseModel):
    """Structured response from the classifier.  The ``type`` field
    contains the predicted document type, and ``confidence`` is a
    floating‑point measure of the model’s confidence (0–1).
    """

    type: DocumentType = Field(
        ..., description="Predicted document type from the known list"
    )
    confidence: float = Field(
        ..., description="Confidence score between 0 and 1"
    )


def load_doc_types(config_path: Optional[Path] = None) -> Dict[str, Dict[str, str]]:
    """Load the document types configuration from a YAML file.

    Args:
        config_path: Optional path to the YAML config.  If omitted it
            defaults to ``document_processing/config/doc_types.yaml`` relative
            to this module.

    Returns:
        A mapping of document type names to a dictionary containing
        ``description`` and ``instructions`` keys.
    """
    import yaml  # local import to avoid requiring PyYAML globally

    if config_path is None:
        config_path = get_config().get_doc_types_path()
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_instructions_for_type(doc_type: DocumentType) -> str:
    """Retrieve the extraction instructions for a given document type.

    Args:
        doc_type: Enum member identifying the type.

    Returns:
        A string containing the extraction instructions for that type.  If
        the type is unknown the generic ``other`` instructions are returned.
    """
    config = load_doc_types()
    entry = config.get(doc_type.value) or {}
    return entry.get("instructions", "")


def classify_document(
    text: str,
    model: Optional[ChatOpenAI] = None,
    allowed_types: Optional[List[DocumentType]] = None,
) -> ClassificationResult:
    """Use an LLM to classify the document text.

    The function constructs a prompt instructing the model to choose a
    document type from the allowed list and to provide a confidence score.
    It then invokes the model and parses the response into a
    ``ClassificationResult``.  If parsing fails, the function returns a
    result with type ``other`` and zero confidence.

    Args:
        text: The document text to classify.
        model: Optional ``ChatOpenAI`` instance.  If ``None``, a default
            model is instantiated using environment variables.  See
            README for required environment variables.
        allowed_types: Optional subset of document types to consider.  If
            omitted, all known types are allowed.

    Returns:
        A ``ClassificationResult`` containing the predicted type and
        confidence.
    """
    # Initialize LLM if not provided
    if model is None:
        config = get_config()
        if not config.openai_api_key:
            raise ValueError("OPENAI_API_KEY is not set; cannot perform classification")
        model = ChatOpenAI(
            openai_api_key=config.openai_api_key,
            openai_api_base=config.openai_api_base,
            temperature=0.1,
            model_name=config.model_name,
            max_tokens=256,
        )

    # Determine allowed types for the prompt
    if allowed_types is None:
        allowed_types = list(DocumentType)
    allowed_names = [dt.value for dt in allowed_types]

    # Compose prompt using a template
    prompt = ChatPromptTemplate.from_template(
        """
        You are a document classification expert. Choose the most appropriate document type from the following list:
        {allowed_list}

        Document text:
        {text}

        Please respond in JSON format with two fields:
        - "type": one of the allowed document types.
        - "confidence": a number between 0 and 1 representing your confidence in the classification.
        Only provide the JSON and nothing else.
        """
    )
    formatted_prompt = prompt.format(allowed_list=", ".join(allowed_names), text=text)
    raw_response = model.invoke(formatted_prompt)
    try:
        data = json.loads(raw_response.content)
        return ClassificationResult.parse_obj(data)
    except Exception:
        return ClassificationResult(type=DocumentType.OTHER, confidence=0.0)