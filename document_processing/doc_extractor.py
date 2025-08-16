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

import base64
import json
import logging
import os
from pathlib import Path
from typing import Optional, Union

import pytesseract
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from openai import OpenAI
from pdf2image import convert_from_path
from PIL import Image

from .config import get_config

logger = logging.getLogger("doc_ai_extractor")

__all__ = ["ocr_document", "extract_fields"]


def ocr_document(document_path: Union[str, Path]) -> str:
    """Perform OCR on a PDF or image file and return the extracted text.

    Args:
        document_path: Path to a file on disk (PDF, PNG, JPEG, TIFF, etc.).

    Returns:
        A string containing the OCR text.  If OCR fails, an empty string
        is returned.
    """
    # Configure Tesseract and Poppler from config
    config = get_config()
    if config.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = config.tesseract_cmd

    poppler_path = config.poppler_path
    ocr_lang = config.ocr_lang

    path = Path(document_path)
    if not path.exists():
        raise FileNotFoundError(f"Document not found: {path}")

    text = ""
    try:
        # Handle PDFs by converting each page to an image
        if path.suffix.lower() == ".pdf":
            try:
                if poppler_path and os.path.exists(poppler_path):
                    images = convert_from_path(str(path), poppler_path=poppler_path)
                else:
                    images = convert_from_path(str(path))
                for img in images:
                    page_text = pytesseract.image_to_string(img, lang=ocr_lang)
                    text += page_text + "\n"
            except Exception as pdf_error:
                logger.warning("PDF conversion failed for %s: %s", path, pdf_error)
                # Try to treat as image if PDF conversion fails
                try:
                    with Image.open(path) as img:
                        text = pytesseract.image_to_string(img, lang=ocr_lang)
                except Exception as img_error:
                    logger.exception(
                        "Both PDF and image OCR failed for %s: PDF error: %s, Image error: %s",
                        path, pdf_error, img_error
                    )
                    return ""
        else:
            # For image formats open directly
            try:
                with Image.open(path) as img:
                    text = pytesseract.image_to_string(img, lang=ocr_lang)
            except Exception as img_error:
                logger.exception("Image OCR failed for %s: %s", path, img_error)
                return ""
    except Exception as e:
        # In case of any unexpected OCR error, log and return empty string
        logger.exception("Unexpected OCR error for %s: %s", path, e)
        return ""
    
    result = text.strip()
    logger.info("OCR completed for %s: extracted %d characters", path.name, len(result))
    return result


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
        config = get_config()
        model = ChatOpenAI(
            openai_api_key=config.openai_api_key,
            openai_api_base=config.openai_api_base,
            temperature=0.0,
            model_name=config.model_name,
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


def extract_fields_from_image(
    image_path: Union[str, Path],
    instructions: str,
    model_name: Optional[str] = None,
    max_output_chars: int = 3000,
) -> dict:
    """Use OpenAI Vision to extract JSON directly from an image when OCR is unavailable.

    Args:
        image_path: Path to image file (jpg/png/jpeg/tif/tiff).
        instructions: Extraction instruction text.
        model_name: Optional model override (defaults to env MODEL_NAME or gpt-4o).
        max_output_chars: Truncation for instructions to keep prompt bounded.
    """
    path = Path(image_path)
    if not path.exists():
        return {}
    
    # For temp files, try to process regardless of extension
    # For regular files, check extension
    suffix = path.suffix.lower()
    if suffix and suffix not in {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".pdf", ".tmp"}:
        logger.warning("Unsupported file extension %s, trying anyway", suffix)
        # Continue processing anyway for temp files

    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    config = get_config()
    mime = "image/png" if suffix == ".png" else "image/jpeg"
    model = model_name or config.model_name
    client = OpenAI(api_key=config.openai_api_key, base_url=config.openai_api_base)

    system_prompt = (
        "You are a document data extraction expert. "
        "You will receive an image of a document and extraction instructions. "
        "Your ONLY job is to return a valid JSON object with the extracted data. "
        "CRITICAL: Never return an empty JSON object {}. "
        "If you cannot read something clearly, make your best guess or use 'Unknown'. "
        "Use exactly the field names shown in the extraction template."
    )

    try:
        logger.info("Sending image to GPT Vision for extraction, model: %s", model)
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                                                    {
                                "type": "text", 
                                "text": (
                                    "Look at this document image carefully. Extract the following "
                                    f"data and return ONLY a JSON object:\n\n"
                                    f"{instructions[:max_output_chars]}\n\n"
                                    "IMPORTANT: Always return a JSON object, even if you can only "
                                    "extract partial information. Do not return empty objects."
                                )
                            },
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                    ],
                },
            ],
            response_format={"type": "json_object"},
            max_completion_tokens=1200,
        )
        content = resp.choices[0].message.content or "{}"
        logger.info(
            "GPT-4o Vision response: %s", 
            content[:200] + "..." if len(content) > 200 else content
        )
        
        try:
            parsed = json.loads(content)
            if parsed:  # If we got data, return it
                logger.info(
                    "Successfully parsed vision extraction result with %d fields", len(parsed)
                )
                return parsed
            else:
                logger.warning("GPT returned empty JSON, trying fallback")
        except Exception as parse_error:
            logger.warning("Failed to parse JSON response: %s", parse_error)
            # Attempt to strip code fences if present
            cleaned = content.strip().strip('`').strip('json').strip('`')
            try:
                parsed = json.loads(cleaned)
                if parsed:
                    logger.info(
                        "Successfully parsed cleaned vision extraction result with %d fields", 
                        len(parsed)
                    )
                    return parsed
            except Exception:
                logger.error("Failed to parse even cleaned JSON response: %s", cleaned[:100])
        
        # No fallback - if it doesn't work, it doesn't work
        logger.error("Vision extraction completely failed - GPT-5 returned empty or invalid JSON")
        return {}
    except Exception as e:
        logger.exception("Vision extraction failed with error: %s", e)
        return {}