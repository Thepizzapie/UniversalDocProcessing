"""OCR provider interface and implementations."""

from abc import ABC, abstractmethod


class OcrProviderInterface(ABC):
    """Interface for OCR providers."""

    @abstractmethod
    def extract_text(self, content: bytes) -> str:
        """Extract text from document content."""
        pass


class TesseractOcrProvider(OcrProviderInterface):
    """Tesseract OCR provider (placeholder implementation)."""

    def extract_text(self, content: bytes) -> str:
        """Extract text using Tesseract OCR."""
        try:
            # Placeholder for actual Tesseract implementation
            # In a real implementation, you would:
            # 1. Use PIL to open the image/PDF
            # 2. Use pytesseract to extract text
            # 3. Return the extracted text

            # For now, return a placeholder
            return f"OCR extraction not implemented. Content size: {len(content)} bytes"

        except Exception as e:
            return f"OCR extraction failed: {str(e)}"


class EchoOcrProvider(OcrProviderInterface):
    """Echo OCR provider for testing (returns placeholder text)."""

    def extract_text(self, content: bytes) -> str:
        """Return placeholder text based on content."""
        if content:
            return f"Sample extracted text from {len(content)}-byte document"
        return "Sample extracted text from empty document"


# Default OCR provider instance
default_ocr_provider = EchoOcrProvider()


def extract_text(content: bytes) -> str:
    """Convenience function to extract text from content."""
    return default_ocr_provider.extract_text(content)
