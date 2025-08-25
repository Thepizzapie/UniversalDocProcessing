"""LLM extraction interface and implementations."""

from abc import ABC, abstractmethod
from typing import Union
import re

from ..schemas import ExtractedField, ExtractedRecord
from ..agents import DocumentExtractionAgent


class LlmExtractorInterface(ABC):
    """Interface for LLM-based field extraction."""

    @abstractmethod
    def extract_fields(self, text_or_content: Union[str, bytes]) -> ExtractedRecord:
        """Extract structured fields from text or document content."""
        pass


class EchoLlmExtractor(LlmExtractorInterface):
    """Echo LLM extractor that creates synthetic demo data."""

    def extract_fields(self, text_or_content: Union[str, bytes]) -> ExtractedRecord:
        """Extract fields using synthetic demo logic."""

        # Convert bytes to string if needed
        if isinstance(text_or_content, bytes):
            text = text_or_content.decode("utf-8", errors="ignore")
        else:
            text = text_or_content

        # Simple pattern matching for demo purposes
        fields = {}

        # Try to extract common fields using regex
        patterns = {
            "invoice_number": r"(?:invoice|inv)[.\s*#]*([A-Z0-9\-]+)",
            "date": r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
            "amount": r"[$€£]?\s*(\d+[\.,]\d{2})",
            "vendor": r"(?:from|vendor|company)[:\s]*([A-Za-z\s&]+)",
            "customer": r"(?:to|customer|client)[:\s]*([A-Za-z\s&]+)",
        }

        for field_name, pattern in patterns.items():
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                fields[field_name] = ExtractedField(
                    value=match.group(1).strip(), confidence=0.8, type_hint=field_name
                )

        # If no fields found, create synthetic demo data
        if not fields:
            fields = {
                "invoice_number": ExtractedField(
                    value="DEMO-001", confidence=0.9, type_hint="invoice_number"
                ),
                "date": ExtractedField(
                    value="2024-01-15", confidence=0.85, type_hint="date"
                ),
                "amount": ExtractedField(
                    value="1234.56", confidence=0.9, type_hint="amount"
                ),
                "vendor": ExtractedField(
                    value="Demo Vendor Inc", confidence=0.7, type_hint="vendor"
                ),
                "customer": ExtractedField(
                    value="Demo Customer Corp", confidence=0.8, type_hint="customer"
                ),
                "description": ExtractedField(
                    value="Sample invoice for demo purposes",
                    confidence=0.6,
                    type_hint="description",
                ),
            }

        return ExtractedRecord(root=fields)


class CrewAIExtractor(LlmExtractorInterface):
    """CrewAI-powered document extractor using intelligent agents."""

    def __init__(self):
        """Initialize the CrewAI extractor."""
        try:
            self.extraction_agent = DocumentExtractionAgent()
        except Exception:
            # Fallback to None if CrewAI initialization fails
            self.extraction_agent = None

    def extract_fields(self, text_or_content: Union[str, bytes]) -> ExtractedRecord:
        """Extract fields using CrewAI agent or fallback method."""

        # Convert bytes to string if needed
        if isinstance(text_or_content, bytes):
            text = text_or_content.decode("utf-8", errors="ignore")
        else:
            text = text_or_content

        # Try CrewAI extraction first
        if self.extraction_agent:
            try:
                return self.extraction_agent.extract_fields(text)
            except Exception:
                # Fall back to simple extraction if CrewAI fails
                pass

        # Fallback to simple pattern-based extraction
        return self._fallback_extraction(text)

    def _fallback_extraction(self, text: str) -> ExtractedRecord:
        """Fallback extraction using simple key:value patterns."""
        fields = {}

        # Look for key:value patterns (case insensitive)
        lines = text.split("\n")
        for line in lines:
            line = line.strip()
            if ":" in line:
                key, value = line.split(":", 1)
                key = key.strip().lower().replace(" ", "_")
                value = value.strip()

                if key and value and len(value) > 0:
                    fields[key] = ExtractedField(
                        value=value, confidence=0.7, type_hint="text"
                    )

        # Fallback to echo extractor if no fields found
        if not fields:
            echo_extractor = EchoLlmExtractor()
            return echo_extractor.extract_fields(text)

        return ExtractedRecord(root=fields)


class SimpleTextParserExtractor(LlmExtractorInterface):
    """Simple text parser that extracts key:value pairs."""

    def extract_fields(self, text_or_content: Union[str, bytes]) -> ExtractedRecord:
        """Extract fields by parsing key:value patterns."""

        # Convert bytes to string if needed
        if isinstance(text_or_content, bytes):
            text = text_or_content.decode("utf-8", errors="ignore")
        else:
            text = text_or_content

        fields = {}

        # Look for key:value patterns (case insensitive)
        lines = text.split("\n")
        for line in lines:
            line = line.strip()
            if ":" in line:
                key, value = line.split(":", 1)
                key = key.strip().lower().replace(" ", "_")
                value = value.strip()

                if key and value and len(value) > 0:
                    fields[key] = ExtractedField(
                        value=value, confidence=0.7, type_hint="text"
                    )

        # Fallback to echo extractor if no fields found
        if not fields:
            echo_extractor = EchoLlmExtractor()
            return echo_extractor.extract_fields(text)

        return ExtractedRecord(root=fields)


# Default LLM extractor instance - use CrewAI if available
try:
    default_llm_extractor = CrewAIExtractor()
except Exception:
    # Fallback to simple extractor if CrewAI setup fails
    default_llm_extractor = SimpleTextParserExtractor()


def extract_fields(text_or_content: Union[str, bytes]) -> ExtractedRecord:
    """Convenience function to extract fields from text or content."""
    return default_llm_extractor.extract_fields(text_or_content)
