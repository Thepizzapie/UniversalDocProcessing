"""CrewAI integration service for the document processing pipeline."""

import os
from typing import Any

from loguru import logger

from ..agents import DocumentProcessingCrew
from ..config import get_current_settings
from ..enums import ReconcileStrategy
from ..schemas import ExtractedRecord


class CrewAIService:
    """Service for integrating CrewAI agents into the document processing pipeline."""

    def __init__(self):
        """Initialize the CrewAI service."""
        self._crew = None
        self._enabled = None
        self._initialize_with_current_settings()

    def _initialize_with_current_settings(self):
        """Initialize CrewAI with current settings."""
        current_settings = get_current_settings()
        self._enabled = current_settings.crewai_enabled

        print(f"DEBUG: CrewAI enabled in settings: {self._enabled}")
        print(
            f"DEBUG: OpenAI API key in settings: {'Yes' if current_settings.openai_api_key else 'No'}"
        )
        print(f"DEBUG: LLM model: {current_settings.llm_model}")

        # Set OpenAI API key in environment if provided in settings
        if current_settings.openai_api_key:
            os.environ["OPENAI_API_KEY"] = current_settings.openai_api_key
            os.environ["CHROMA_OPENAI_API_KEY"] = current_settings.openai_api_key
            print("DEBUG: Set OPENAI_API_KEY and CHROMA_OPENAI_API_KEY in environment")
        else:
            print("DEBUG: No OpenAI API key found in settings")

        if self._enabled:
            try:
                print("DEBUG: Initializing DocumentProcessingCrew...")
                self._crew = DocumentProcessingCrew(current_settings.llm_model)
                print("DEBUG: CrewAI service initialized successfully!")
                logger.info("CrewAI service initialized successfully")
            except Exception as e:
                print(f"DEBUG: Failed to initialize CrewAI: {e}")
                logger.warning(f"Failed to initialize CrewAI: {e}")
                self._enabled = False
        else:
            print("DEBUG: CrewAI not enabled in settings")
            self._crew = None

    def reload_configuration(self):
        """Reload the service with updated settings."""
        print("DEBUG: Reloading CrewAI configuration...")
        self._initialize_with_current_settings()

    @property
    def is_enabled(self) -> bool:
        """Check if CrewAI is enabled and available."""
        return self._enabled and self._crew is not None

    def extract_document_data(
        self,
        document_text: str,
        document_type: str = "invoice",
        expected_fields: list[str] | None = None,
        extraction_context: dict | None = None,
    ) -> ExtractedRecord | None:
        """Extract structured data from document using CrewAI agents."""
        print(f"DEBUG: extract_document_data called with type: {document_type}")
        print(f"DEBUG: Service enabled: {self.is_enabled}")
        print(f"DEBUG: Crew exists: {self._crew is not None}")

        if not self.is_enabled:
            print("DEBUG: CrewAI not enabled, skipping agent extraction")
            logger.debug("CrewAI not enabled, skipping agent extraction")
            return None

        try:
            print(f"DEBUG: Calling crew.extract_data with text length: {len(document_text)}")
            print(f"DEBUG: Expected fields: {expected_fields}")
            if extraction_context:
                print(f"DEBUG: Extraction context provided keys: {list(extraction_context.keys())}")
            result = self._crew.extract_data(document_text, document_type, expected_fields, extraction_context)
            print(f"DEBUG: CrewAI extraction completed! Result type: {type(result)}")
            if result:
                print(f"DEBUG: Result has {len(result.root)} fields")
            else:
                print("DEBUG: Result is None")
            logger.info(f"CrewAI extraction completed for {document_type}")
            return result
        except Exception as e:
            print(f"DEBUG: CrewAI extraction failed with error: {e}")
            logger.error(f"CrewAI extraction failed: {e}")
            return None

    def validate_extracted_data(
        self, extracted_fields: dict[str, Any], document_context: str = ""
    ) -> dict[str, Any] | None:
        """Validate extracted data using CrewAI validation agent."""
        if not self.is_enabled:
            logger.debug("CrewAI not enabled, skipping agent validation")
            return None

        try:
            result = self._crew.validate_data(extracted_fields, document_context)
            logger.info("CrewAI validation completed")
            return result
        except Exception as e:
            logger.error(f"CrewAI validation failed: {e}")
            return None

    def reconcile_data(
        self,
        extracted_data: dict[str, Any],
        external_data: dict[str, Any],
        strategy: ReconcileStrategy = ReconcileStrategy.LOOSE,
    ) -> tuple | None:
        """Reconcile data using CrewAI reconciliation agent."""
        if not self.is_enabled:
            logger.debug("CrewAI not enabled, skipping agent reconciliation")
            return None

        try:
            result = self._crew.reconcile_data(extracted_data, external_data, strategy)
            logger.info("CrewAI reconciliation completed")
            return result
        except Exception as e:
            logger.error(f"CrewAI reconciliation failed: {e}")
            return None

    def process_document_complete(
        self,
        document_text: str,
        document_type: str = "invoice",
        external_data: dict[str, Any] | None = None,
        reconcile_strategy: ReconcileStrategy = ReconcileStrategy.LOOSE,
    ) -> dict[str, Any] | None:
        """Process document through complete CrewAI pipeline."""
        if not self.is_enabled:
            logger.debug("CrewAI not enabled, skipping complete processing")
            return None

        try:
            result = self._crew.process_document_complete(
                document_text=document_text,
                document_type=document_type,
                external_data=external_data,
                reconcile_strategy=reconcile_strategy,
            )
            logger.info(
                f"CrewAI complete processing finished with status: {result.get('processing_status')}"
            )
            return result
        except Exception as e:
            logger.error(f"CrewAI complete processing failed: {e}")
            return None

    def get_service_status(self) -> dict[str, Any]:
        """Get current status of the CrewAI service."""
        status = {
            "enabled": self._enabled,
            "available": self.is_enabled,
            "crew_initialized": self._crew is not None,
        }

        if self._crew:
            try:
                crew_status = self._crew.get_crew_status()
                status.update(crew_status)
            except Exception as e:
                status["crew_error"] = str(e)

        return status

    def generate_document_schema(
        self, document_description: str, document_type: str = "custom"
    ) -> dict[str, Any] | None:
        """Generate a JSON schema for document extraction using AI."""
        if not self.is_enabled:
            logger.debug("CrewAI not enabled, skipping schema generation")
            return None

        try:
            from langchain_openai import ChatOpenAI
            from langchain.prompts import PromptTemplate
            from langchain.chains import LLMChain
            import json

            # Initialize LLM
            llm = ChatOpenAI(
                model=get_current_settings().llm_model,
                temperature=0.1,  # Low temperature for consistent schema generation
                openai_api_key=get_current_settings().openai_api_key
            )

            # Create schema generation prompt
            schema_prompt = PromptTemplate(
                input_variables=["document_description", "document_type"],
                template="""
You are an expert at creating JSON schemas for document data extraction. Based on the following document description, create a comprehensive JSON schema for extracting structured data.

Document Type: {document_type}
Document Description: {document_description}

CRITICAL SCHEMA STRUCTURE GUIDANCE:

**WHEN TO USE OBJECTS vs ARRAYS:**

1. **Use OBJECT** when extracting single values or fixed sets of related data:
   - Document header information
   - Single customer/vendor details
   - Invoice summary data
   - Document metadata (dates, totals, IDs)

2. **Use ARRAY of OBJECTS** when extracting tabular data or repeating structures:
   - Line items in invoices/receipts
   - Transaction lists
   - Multiple entries in a table
   - Repeating sections with the same structure
   - Child records related to a parent document

3. **DUAL-PACKAGE DETECTION PATTERNS:**
   - **Header + Table:** "header details... then extract table", "first extract header... then table"
   - **Parent + Child:** "parent object... child entries", "main data... table rows"
   - **Two-Step Process:** "extract... then extract", "first... then", "followed by"
   - **Mixed Data Types:** "header info AND table data", "summary AND line items"

**IMPORTANT:** If the user prompt clearly indicates dual-package requirements (header/table, parent/child, two-step extraction), ALWAYS create a schema with both parent object AND child array, even if not explicitly requested. The system will handle the dual-package processing automatically.

**RECOGNIZE THESE PATTERNS FOR DUAL-PACKAGE:**
- "First extract header/details THEN extract table/rows"
- "Parent object with X, Y, Z AND child entries with A, B, C"
- "Header information followed by table data"
- "Main document data plus line items/details"
- "Summary information and detailed records"

**ALWAYS CREATE DUAL-PACKAGE SCHEMA FOR THESE CASES:**
- Put header/summary data in the main object
- Put table/row/entry data in an array called "entries", "items", "records", etc.
- Use descriptive array names based on the content (e.g., "load_entries", "line_items")

**SCHEMA REQUIREMENTS:**

1. Use proper JSON Schema format (draft-07)
2. Include appropriate field types (string, number, boolean, array, object)
3. Add descriptive titles and descriptions for each field
4. Mark required fields appropriately based on business logic
5. For arrays, ALWAYS define the complete "items" object structure
6. Use sensible default values where appropriate
7. Consider common fields for the document type (dates, amounts, identifiers, etc.)

**ARRAY SCHEMA FORMAT:**
When using arrays, use this exact structure:
{{
  "field_name": {{
    "type": "array",
    "title": "Descriptive Array Title",
    "description": "What this array contains",
    "items": {{
      "type": "object",
      "properties": {{
        "child_field1": {{"type": "string", "description": "..."}},
        "child_field2": {{"type": "number", "description": "..."}}
      }},
      "required": ["required_child_fields"]
    }}
  }}
}}

Return only the JSON schema object, no additional text or explanations.

Example for invoice with line items:
{{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {{
    "invoice_number": {{
      "type": "string",
      "title": "Invoice Number",
      "description": "Unique invoice identifier"
    }},
    "line_items": {{
      "type": "array",
      "title": "Line Items",
      "description": "List of items in the invoice",
      "items": {{
        "type": "object",
        "properties": {{
          "description": {{"type": "string", "title": "Item Description"}},
          "quantity": {{"type": "number", "title": "Quantity"}},
          "price": {{"type": "number", "title": "Unit Price"}}
        }},
        "required": ["description", "quantity"]
      }}
    }}
  }},
  "required": ["invoice_number"]
}}
"""
            )

            # Create and run the chain
            chain = LLMChain(llm=llm, prompt=schema_prompt)
            schema_text = chain.run(
                document_description=document_description,
                document_type=document_type
            )

            # Parse the generated schema
            try:
                # Clean the response (remove markdown code blocks if present)
                schema_text = schema_text.strip()
                if schema_text.startswith("```json"):
                    schema_text = schema_text[7:]
                if schema_text.startswith("```"):
                    schema_text = schema_text[3:]
                if schema_text.endswith("```"):
                    schema_text = schema_text[:-3]

                schema = json.loads(schema_text.strip())

                # Validate basic schema structure
                if not isinstance(schema, dict) or "properties" not in schema:
                    logger.warning("Generated schema is missing required structure")
                    return None

                # Add required field if not present
                if "required" not in schema:
                    schema["required"] = []

                logger.info(f"Successfully generated schema for {document_type}")
                return schema

            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse generated schema JSON: {e}")
                logger.debug(f"Generated schema text: {schema_text}")
                return None

        except Exception as e:
            logger.error(f"AI schema generation failed: {e}")
            return None

    def health_check(self) -> dict[str, Any]:
        """Perform health check on CrewAI components."""
        health = {"status": "healthy" if self.is_enabled else "disabled", "components": {}}

        if not self.is_enabled:
            health["message"] = "CrewAI service is disabled or not available"
            return health

        try:
            # Test basic crew functionality
            test_text = "Invoice #TEST-001 Date: 2024-01-01 Amount: $100.00"
            extraction_result = self.extract_document_data(test_text, "test")

            health["components"]["extraction"] = {
                "status": "healthy" if extraction_result else "failed",
                "test_passed": extraction_result is not None,
            }

        except Exception as e:
            health["status"] = "unhealthy"
            health["error"] = str(e)
            health["components"]["extraction"] = {"status": "failed", "error": str(e)}

        return health


# Global CrewAI service instance
crewai_service = CrewAIService()
