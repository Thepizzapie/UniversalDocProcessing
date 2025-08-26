"""OCR adapter for extracting text from documents."""

import base64
import io
from typing import Any

import cv2
import numpy as np
import pytesseract
from loguru import logger
from PIL import Image

from ..config import settings


def extract_text_from_bytes(content: bytes, mime_type: str) -> str:
    """Extract text from document bytes using OCR.

    Args:
        content: Document content as bytes
        mime_type: MIME type of the document

    Returns:
        Extracted text or empty string if extraction fails
    """
    if not settings.ocr_enabled:
        logger.warning("OCR is disabled in settings")
        return ""

    try:
        # Handle different mime types
        if mime_type.startswith("text/"):
            # Plain text - decode directly
            return content.decode("utf-8", errors="ignore")

        elif mime_type.startswith("image/"):
            # Image files - use OCR
            return _extract_text_from_image_bytes(content)

        elif mime_type == "application/pdf":
            # PDF files - convert to images then OCR
            return _extract_text_from_pdf_bytes(content)

        else:
            logger.warning(f"Unsupported MIME type for OCR: {mime_type}")
            return ""

    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        return ""


def extract_text_from_base64(base64_content: str, mime_type: str) -> str:
    """Extract text from base64 encoded content.

    Args:
        base64_content: Base64 encoded document content
        mime_type: MIME type of the document

    Returns:
        Extracted text or empty string if extraction fails
    """
    try:
        # Decode base64 content
        content = base64.b64decode(base64_content)
        return extract_text_from_bytes(content, mime_type)

    except Exception as e:
        logger.error(f"Base64 decoding failed: {e}")
        return ""


def _extract_text_from_image_bytes(image_bytes: bytes) -> str:
    """Extract text from image bytes using Tesseract OCR."""
    try:
        # Convert bytes to PIL Image
        image = Image.open(io.BytesIO(image_bytes))

        # Convert to RGB if necessary
        if image.mode != "RGB":
            image = image.convert("RGB")

        # Convert PIL image to OpenCV format for preprocessing
        opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

        # Preprocess image for better OCR
        processed_image = _preprocess_image(opencv_image)

        # Convert back to PIL for Tesseract
        processed_pil = Image.fromarray(cv2.cvtColor(processed_image, cv2.COLOR_BGR2RGB))

        # Configure Tesseract
        config = f"--psm 3 -l {settings.ocr_language}"

        # Extract text
        text = pytesseract.image_to_string(processed_pil, config=config)

        return text.strip()

    except Exception as e:
        logger.error(f"Image OCR failed: {e}")
        return ""


def _extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes by converting to images first.

    Note: This is a basic implementation. For production use,
    consider using pdf2image or similar libraries.
    """
    try:
        # For now, return empty string as PDF processing requires additional dependencies
        # In production, you would use pdf2image to convert PDF pages to images
        # then apply OCR to each page
        logger.warning("PDF OCR not fully implemented - requires pdf2image dependency")
        return ""

    except Exception as e:
        logger.error(f"PDF OCR failed: {e}")
        return ""


def _preprocess_image(image: np.ndarray) -> np.ndarray:
    """Preprocess image to improve OCR accuracy."""
    try:
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Apply denoising
        denoised = cv2.fastNlMeansDenoising(gray)

        # Apply thresholding to get binary image
        _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Convert back to BGR for consistency
        return cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)

    except Exception as e:
        logger.error(f"Image preprocessing failed: {e}")
        # Return original image if preprocessing fails
        return image


def validate_ocr_dependencies() -> dict[str, Any]:
    """Validate that OCR dependencies are properly installed."""
    status = {
        "tesseract_available": False,
        "tesseract_version": None,
        "languages_available": [],
        "error": None,
    }

    try:
        # Check if Tesseract is available
        version = pytesseract.get_tesseract_version()
        status["tesseract_available"] = True
        status["tesseract_version"] = str(version)

        # Get available languages
        languages = pytesseract.get_languages()
        status["languages_available"] = languages

        # Check if configured language is available
        if settings.ocr_language not in languages:
            status["error"] = f"Configured language '{settings.ocr_language}' not available"

    except Exception as e:
        status["error"] = str(e)

    return status
