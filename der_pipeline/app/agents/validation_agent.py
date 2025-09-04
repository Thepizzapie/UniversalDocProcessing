"""Validation agent using CrewAI for data quality checks."""

import os
import re
import sys

from crewai import Agent, Task
from langchain.prompts import PromptTemplate
from langchain.tools import Tool
from langchain_openai import ChatOpenAI

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.schemas import CorrectedField, ExtractedField


class ValidationAgent:
    """CrewAI agent for validating extracted document data."""

    def __init__(self, llm_model: str = "gpt-4o"):
        """Initialize the validation agent."""
        # Load API key from config file
        api_key = None
        try:
            import os

            config_file = "config.json"
            if os.path.exists(config_file):
                import json

                with open(config_file) as f:
                    config = json.load(f)
                    api_key = config.get("openai_api_key")
        except:
            pass

        # Fallback to settings if config file doesn't have it
        if not api_key:
            api_key = settings.openai_api_key

        # Use the new OpenAI client format

        self.llm = ChatOpenAI(
            model=llm_model,
            temperature=1.0 if llm_model == "gpt-5" else 0.0,  # Use default temp for gpt-5
            openai_api_key=api_key,
        )

        self.validation_prompt = PromptTemplate(
            input_variables=["extracted_data", "document_context"],
            template="""
            You are a meticulous data quality analyst specializing in business document validation.

            Document Context: {document_context}
            Extracted Data: {extracted_data}

            Validate each extracted field for:
            1. Format correctness (dates, amounts, IDs)
            2. Logical consistency (dates not in future, amounts positive)
            3. Completeness (required fields present)
            4. Data type appropriateness

            For each field, provide:
            - field_name: The name of the field
            - is_valid: boolean indicating if the field is valid
            - confidence_adjustment: adjustment to confidence (-0.5 to +0.5)
            - validation_notes: specific issues found or validation passed
            - suggested_correction: if invalid, suggest a correction

            Common validation rules:
            - Invoice numbers should be alphanumeric
            - Dates should be in valid format and not in future
            - Amounts should be positive numbers
            - Vendor/customer names should not be empty
            - Currency codes should be 3 letters (USD, EUR, etc.)

            Return results as JSON array of validation results.
            """,
        )

        self.agent = Agent(
            role="Data Quality Validator",
            goal="Ensure extracted document data meets quality standards and business rules",
            backstory="""You are an experienced data quality specialist who has worked with
            thousands of business documents. You have a keen eye for inconsistencies, formatting
            errors, and logical issues. Your validation prevents costly errors downstream.""",
            verbose=True,
            allow_delegation=False,
            llm=self.llm,
            tools=[],
        )

    def _create_validation_tool(self):
        """Create the validation tool."""

        def validate_data(extracted_data: str) -> str:
            """Validate extracted document data."""
            try:
                prompt = self.validation_prompt.format(
                    extracted_data=extracted_data, document_context="business_document"
                )
                response = self.llm.invoke(prompt)
                return response.content
            except Exception as e:
                return f"Error during validation: {str(e)}"

        return Tool(
            name="data_validator",
            description="Validates extracted document data for quality and consistency",
            func=validate_data,
        )

    def validate_extracted_fields(
        self, extracted_fields: dict[str, ExtractedField], document_context: str = ""
    ) -> dict[str, ExtractedField]:
        """Validate extracted fields and adjust confidence scores."""

        # Convert extracted fields to string representation
        fields_str = self._format_fields_for_validation(extracted_fields)

        task = Task(
            description=f"""
            Validate the following extracted document data for quality and consistency:

            Document Context: {document_context}
            Extracted Fields: {fields_str}

            Check each field for format correctness, logical consistency, and completeness.
            Provide validation results with confidence adjustments and suggested corrections.
            """,
            agent=self.agent,
            expected_output="JSON array with validation results for each field",
        )

        try:
            # Execute validation task
            result = task.execute()

            # Apply validation results to update confidence scores
            return self._apply_validation_results(extracted_fields, result)

        except Exception:
            # Fallback to simple validation if CrewAI fails
            return self._fallback_validation(extracted_fields)

    def _format_fields_for_validation(self, fields: dict[str, ExtractedField]) -> str:
        """Format extracted fields for validation prompt."""
        formatted = []
        for name, field in fields.items():
            formatted.append(
                f"{name}: {field.value} (confidence: {field.confidence}, type: {field.type_hint})"
            )
        return "\n".join(formatted)

    def _apply_validation_results(
        self, original_fields: dict[str, ExtractedField], validation_result: str
    ) -> dict[str, ExtractedField]:
        """Apply validation results to update field confidence scores."""
        import json

        try:
            # Try to extract JSON from the result
            json_match = re.search(r"\[.*\]", validation_result, re.DOTALL)
            if json_match:
                validations = json.loads(json_match.group())
            else:
                # If no JSON array found, try parsing the entire result
                validations = json.loads(validation_result)

            updated_fields = original_fields.copy()

            for validation in validations:
                field_name = validation.get("field_name")
                if field_name in updated_fields:
                    field = updated_fields[field_name]

                    # Apply confidence adjustment
                    confidence_adj = validation.get("confidence_adjustment", 0)
                    new_confidence = max(0.0, min(1.0, field.confidence + confidence_adj))

                    # Create updated field
                    updated_fields[field_name] = ExtractedField(
                        value=field.value, confidence=new_confidence, type_hint=field.type_hint
                    )

            return updated_fields

        except (json.JSONDecodeError, KeyError):
            # If parsing fails, return original fields
            return original_fields

    def _fallback_validation(self, fields: dict[str, ExtractedField]) -> dict[str, ExtractedField]:
        """Fallback validation using simple rules."""

        updated_fields = {}

        for name, field in fields.items():
            confidence = field.confidence
            value = str(field.value) if field.value is not None else ""

            # Simple validation rules
            if name.lower() in ["date"] and value:
                # Check if date format is valid
                date_patterns = [r"\d{4}-\d{2}-\d{2}", r"\d{2}[/-]\d{2}[/-]\d{4}"]
                if not any(re.match(pattern, value) for pattern in date_patterns):
                    confidence = max(0.0, confidence - 0.2)

            elif name.lower() in ["amount", "total"] and value:
                # Check if amount is a valid number
                try:
                    float_val = float(re.sub(r"[^\d.]", "", value))
                    if float_val <= 0:
                        confidence = max(0.0, confidence - 0.3)
                except ValueError:
                    confidence = max(0.0, confidence - 0.4)

            elif name.lower() in ["invoice_number", "id"] and value:
                # Check if ID has reasonable format
                if len(value.strip()) < 3:
                    confidence = max(0.0, confidence - 0.2)

            elif name.lower() in ["vendor", "customer"] and value:
                # Check if name is not empty and has reasonable length
                if len(value.strip()) < 2:
                    confidence = max(0.0, confidence - 0.3)

            updated_fields[name] = ExtractedField(
                value=field.value, confidence=confidence, type_hint=field.type_hint
            )

        return updated_fields

    def suggest_corrections(
        self, fields: dict[str, ExtractedField], original_text: str
    ) -> dict[str, CorrectedField]:
        """Suggest corrections for low-confidence fields."""
        suggestions = {}

        for name, field in fields.items():
            if field.confidence < 0.7:  # Low confidence threshold
                # Create a correction suggestion
                suggestions[name] = CorrectedField(
                    value=field.value,
                    confidence=min(0.8, field.confidence + 0.1),  # Slight boost
                    type_hint=field.type_hint,
                    correction_reason=f"Low confidence ({field.confidence:.2f}) - manual review recommended",
                )

        return suggestions
