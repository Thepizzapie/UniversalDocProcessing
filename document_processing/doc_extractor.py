"""
doc_extractor
=============

Functions to perform OCR on documents and extract structured fields
according to provided instructions.  This module wraps the Tesseract OCR
engine via the ``pytesseract`` library and uses LangChain with OpenAI’s
chat models to parse unstructured text into JSON.

Tesseract is one of the most widely used open‑source OCR engines and
supports many languages【338526031127972†L108-L116】.  It has benefited from
deep learning improvements over the years and provides a good balance of
accuracy and flexibility at no cost.  The ``pdf2image`` library is used
to convert PDF pages into images that Tesseract can read.

Set the ``OPENAI_API_KEY`` environment variable before calling
``extract_fields``.  You may also override the model and endpoint via
``MODEL_NAME`` and ``OPENAI_API_BASE_URL`` environment variables.

"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional, Union

from PIL import Image
import pytesseract
from pdf2image import convert_from_path

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

__all__ = ["ocr_document", "extract_fields"]


def ocr_document(document_path: Union[str, Path]) -> str:
    """Perform OCR on a PDF or image file and return the extracted text.

    Args:
        document_path: Path to a file on disk (PDF, PNG, JPEG, TIFF, etc.).

    Returns:
        A string containing the OCR text.  If OCR fails, an empty string
        is returned.
    """
    path = Path(document_path)
    if not path.exists():
        raise FileNotFoundError(f"Document not found: {path}")

    text = ""
    try:
        # Handle PDFs by converting each page to an image
        if path.suffix.lower() == ".pdf":
            images = convert_from_path(str(path))
            for img in images:
                text += pytesseract.image_to_string(img)
        else:
            # For image formats open directly
            with Image.open(path) as img:
                text = pytesseract.image_to_string(img)
    except Exception:
        # In case of any OCR error, return empty string
        return ""
    return text.strip()


def extract_fields(
    text: str,
    instructions: str,
    model: Optional[ChatOpenAI] = None,
    max_output_chars: int = 3000,
) -> dict:
    """Use an LLM to extract structured data from text based on instructions.

    The caller must provide a set of extraction instructions (for example
    those returned from ``get_instructions_for_type`` in
    ``doc_classifier``).  The LLM is prompted with the instructions and
    the text and is asked to produce a JSON object.  The result is
    parsed into a Python dictionary.  If parsing fails, an empty
    dictionary is returned.

    Args:
        text: Raw text extracted from the document.
        instructions: String describing what to extract and how to format
            the JSON response.
        model: Optional ``ChatOpenAI`` instance.  If omitted a default
            model is constructed using environment variables.
        max_output_chars: Limit the amount of text passed to the LLM to
            avoid extremely long prompts.  The first ``max_output_chars``
            characters of ``text`` will be used.

    Returns:
        A dictionary containing the extracted fields.  If the model
        returns invalid JSON an empty dict is returned.
    """
    if model is None:
        model = ChatOpenAI(
            openai_api_key=os.environ.get("OPENAI_API_KEY"),
            openai_api_base=os.environ.get(
                "OPENAI_API_BASE_URL", "https://api.openai.com/v1"
            ),
            temperature=0.0,
            model_name=os.environ.get("MODEL_NAME", "gpt-4o-mini"),
            max_tokens=2048,
        )

    # Build the prompt instructing the model to follow instructions and return JSON
    prompt = ChatPromptTemplate.from_template(
        """
        You are an information extraction assistant. Follow the instructions
        carefully to extract data from the provided document text. When you
        extract data, respond only with a valid JSON object. Do not include
        any additional commentary.

        Instructions:
        {instructions}

        Document text:
        {text}
        """
    )
    formatted_prompt = prompt.format(
        instructions=instructions,
        text=text[: max_output_chars],
    )
    raw_response = model.invoke(formatted_prompt)
    try:
        return json.loads(raw_response.content)
    except Exception:
        return {}