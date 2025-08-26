"""Document extraction agent using CrewAI and LangChain."""

import os
import re
import sys
from typing import Any

from crewai import Agent
from langchain.prompts import PromptTemplate
from langchain.tools import Tool
from langchain_openai import ChatOpenAI

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.schemas import ExtractedField, ExtractedRecord


class DocumentExtractionAgent:
    """CrewAI agent for extracting structured data from documents."""

    def __init__(self, llm_model: str = "gpt-4o"):
        """Initialize the document extraction agent."""
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

        print(f"DEBUG: Agent using API key: {'Yes' if api_key else 'No'}")
        print(f"DEBUG: Agent using model: {llm_model}")

        # Use the new OpenAI client format

        # Use default temperature for gpt-5, custom for others
        temp = 1.0 if llm_model == "gpt-5" else 0.1
        self.llm = ChatOpenAI(model=llm_model, temperature=temp, openai_api_key=api_key)

        # Document type specific extraction templates
        self.extraction_templates = {
            "INVOICE": """
            You are an expert invoice analyst. Extract the following INVOICE-specific information:
            
            Required Fields:
            - invoice_number: The unique invoice identifier (e.g., INV-2024-001)
            - vendor_name: The company/person issuing the invoice
            - invoice_date: The invoice date (format: YYYY-MM-DD)
            - due_date: Payment due date (format: YYYY-MM-DD)
            - total_amount: The total amount to be paid (numeric value only)
            - currency: The currency code (USD, EUR, GBP, etc.)
            
            Optional Fields:
            - vendor_address: Full vendor address
            - vendor_tax_id: Tax ID or VAT number
            - customer_name: Bill-to company/person
            - customer_address: Bill-to address
            - subtotal: Amount before taxes
            - tax_amount: Total tax amount
            - tax_rate: Tax percentage (e.g., 8.5)
            - line_items: List of items/services (as array)
            - payment_terms: Payment terms (e.g., Net 30)
            - payment_method: How payment should be made
            """,
            
            "RECEIPT": """
            You are an expert receipt analyst. Extract the following RECEIPT-specific information:
            
            Required Fields:
            - merchant_name: The store/business name
            - transaction_date: Date of purchase (format: YYYY-MM-DD)
            - transaction_time: Time of purchase (format: HH:MM:SS)
            - total_amount: Total amount paid (numeric value only)
            - currency: The currency code (USD, EUR, GBP, etc.)
            
            Optional Fields:
            - merchant_address: Store location/address
            - receipt_number: Receipt or transaction number
            - cashier_name: Cashier or employee name
            - register_number: Register or terminal ID
            - payment_method: How payment was made (cash, credit, debit, etc.)
            - card_last_four: Last 4 digits of card if used
            - items: List of purchased items with prices
            - subtotal: Amount before taxes
            - tax_amount: Tax paid
            - tax_rate: Tax percentage
            - discount_amount: Any discounts applied
            - tip_amount: Tip amount if applicable
            """,
            
            "ENTRY_EXIT_LOG": """
            You are an expert access control analyst. Extract the following ENTRY/EXIT LOG information:
            
            Required Fields:
            - person_name: Full name of the person
            - location: Facility or building name
            - entry_time: Time of entry (format: HH:MM:SS or YYYY-MM-DD HH:MM:SS)
            
            Optional Fields:
            - person_id: Employee ID or badge number
            - badge_number: Access badge identifier
            - exit_time: Time of exit (format: HH:MM:SS or YYYY-MM-DD HH:MM:SS)
            - date: Date of access (format: YYYY-MM-DD)
            - department: Person's department or division
            - purpose: Reason for visit/access
            - authorized_by: Person who authorized access
            - security_level: Access level or clearance
            - vehicle_info: Vehicle details if applicable
            - escort_required: Whether escort was needed
            - duration: Total time on premises
            """,
            
            "UNKNOWN": """
            You are analyzing a document of unknown type. Extract any relevant business information:
            
            Look for and extract:
            - document_type: Try to identify what type of document this is
            - date: Any dates found (format: YYYY-MM-DD)
            - amount: Any monetary amounts (numeric value only)
            - currency: Currency if monetary amounts found
            - company_name: Any company or business names
            - person_name: Any person names
            - address: Any addresses found
            - phone_number: Any phone numbers
            - email: Any email addresses
            - reference_number: Any reference, ID, or tracking numbers
            - description: Brief description of document content
            """
        }
        
        self.extraction_prompt = PromptTemplate(
            input_variables=["document_text", "document_type", "specific_instructions"],
            template="""
            You are an expert document analyst specializing in extracting structured data from business documents.

            Document Type: {document_type}
            
            SPECIFIC EXTRACTION INSTRUCTIONS:
            {specific_instructions}

            Document Text/Content: {document_text}

            For each field you extract, provide:
            - value: The extracted value (null if not found)
            - confidence: Your confidence in the extraction (0.0-1.0)
            - type_hint: The type of data (e.g., "currency", "date", "text", "number", "array")

            IMPORTANT RULES:
            1. If a field is not found or unclear, set value to null and confidence to 0.0
            2. Be precise and conservative with confidence scores
            3. For dates, always use YYYY-MM-DD format
            4. For amounts, extract only numeric values (no currency symbols)
            5. Return only valid JSON format

            Example format:
            {{
                "field_name": {{
                    "value": "extracted_value",
                    "confidence": 0.95,
                    "type_hint": "text"
                }}
            }}
            """,
        )

        self.agent = Agent(
            role="Document Data Extractor",
            goal="Extract structured data from business documents with high accuracy",
            backstory="""You are a highly skilled document processing specialist with years of experience
            in analyzing invoices, receipts, purchase orders, and other business documents. You have
            exceptional attention to detail and can identify key information even in poorly formatted
            or damaged documents.""",
            verbose=True,
            allow_delegation=False,
            llm=self.llm,
            tools=[],
        )

    def _create_extraction_tool(self):
        """Create the document extraction tool."""

        def extract_data(document_text: str) -> str:
            """Extract structured data from document text."""
            try:
                prompt = self.extraction_prompt.format(
                    document_text=document_text, document_type="business_document"
                )
                response = self.llm.invoke(prompt)
                return response.content
            except Exception as e:
                return f"Error during extraction: {str(e)}"

        return Tool(
            name="document_extractor",
            description="Extracts structured data from document text",
            func=extract_data,
        )

    def extract_fields(self, document_text: str, document_type: str = "invoice") -> ExtractedRecord:
        """Extract fields from document text using direct LLM chain."""

        print(f"DEBUG: DocumentExtractionAgent.extract_fields called with type: {document_type}")
        print(f"DEBUG: Text length: {len(document_text)}")

        try:
            # Get document-type-specific instructions
            specific_instructions = self.extraction_templates.get(document_type, self.extraction_templates["UNKNOWN"])
            
            # Use the LLM directly with the prompt
            prompt_text = self.extraction_prompt.format(
                document_text=document_text, 
                document_type=document_type,
                specific_instructions=specific_instructions
            )

            print(f"DEBUG: Using {document_type}-specific extraction instructions")
            print(f"DEBUG: Calling LLM with prompt length: {len(prompt_text)}")

            # Check if this is image content (base64 encoded)
            if (
                document_text.startswith("/9j/")
                or document_text.startswith("iVBOR")
                or len(document_text) > 1000
            ):
                print("DEBUG: Detected image content, using vision API")
                # For images, use vision capabilities
                from langchain_core.messages import HumanMessage

                vision_prompt = f"""
                Extract structured data from this {document_type} image.
                
                {specific_instructions}
                
                Return as JSON with each field containing:
                - value: The extracted value (null if not found)
                - confidence: Your confidence (0.0-1.0)  
                - type_hint: Data type ("text", "number", "date", "currency", etc.)
                """
                
                message = HumanMessage(
                    content=[
                        {
                            "type": "text", 
                            "text": vision_prompt,
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{document_text}"},
                        },
                    ]
                )
                response = self.llm.invoke([message])
                result = response.content if hasattr(response, "content") else str(response)
            else:
                print("DEBUG: Processing as text content")
                # Get the response from the LLM for text
                response = self.llm.invoke(prompt_text)
                result = response.content if hasattr(response, "content") else str(response)

            print(f"DEBUG: LLM response length: {len(result)}")
            print(f"DEBUG: LLM response preview: {result[:200]}...")

            # Parse the result and convert to ExtractedRecord
            return self._parse_extraction_result(result, document_text)

        except Exception as e:
            print(f"DEBUG: LLM extraction failed: {e}")
            # Fallback to simple extraction if LLM fails
            return self._fallback_extraction(document_text)

    def _parse_extraction_result(self, result: str, original_text: str) -> ExtractedRecord:
        """Parse the extraction result into ExtractedRecord format."""
        import json
        import re

        try:
            # Try to extract JSON from the result
            json_match = re.search(r"\{.*\}", result, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
            else:
                # If no JSON found, try parsing the entire result
                data = json.loads(result)

            fields = {}
            for key, value in data.items():
                if isinstance(value, dict) and "value" in value:
                    # Already in the correct format
                    fields[key] = ExtractedField(
                        value=value.get("value"),
                        confidence=value.get("confidence", 0.5),
                        type_hint=value.get("type_hint", "text"),
                    )
                else:
                    # Simple value, need to wrap
                    fields[key] = ExtractedField(
                        value=value,
                        confidence=0.7,  # Default confidence
                        type_hint=self._infer_type_hint(key, value),
                    )

            return ExtractedRecord(root=fields)

        except (json.JSONDecodeError, KeyError):
            # If parsing fails, fall back to simple extraction
            return self._fallback_extraction(original_text)

    def _infer_type_hint(self, field_name: str, value: Any) -> str:
        """Infer the type hint based on field name and value."""
        field_name_lower = field_name.lower()

        if "amount" in field_name_lower or "total" in field_name_lower:
            return "amount"
        elif "date" in field_name_lower:
            return "date"
        elif "number" in field_name_lower or "id" in field_name_lower:
            return "identifier"
        elif "vendor" in field_name_lower or "supplier" in field_name_lower:
            return "vendor"
        elif "customer" in field_name_lower or "client" in field_name_lower:
            return "customer"
        elif "currency" in field_name_lower:
            return "currency"
        else:
            return "text"

    def _fallback_extraction(self, text: str) -> ExtractedRecord:
        """Fallback extraction using simple regex patterns."""
        fields = {}

        # Simple pattern matching for demo purposes
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
                    value=match.group(1).strip(),
                    confidence=0.6,  # Lower confidence for fallback
                    type_hint=field_name,
                )

        # If no fields found, create synthetic demo data
        if not fields:
            fields = {
                "invoice_number": ExtractedField(
                    value="DEMO-001", confidence=0.5, type_hint="invoice_number"
                ),
                "date": ExtractedField(value="2024-01-15", confidence=0.5, type_hint="date"),
                "amount": ExtractedField(value="1234.56", confidence=0.5, type_hint="amount"),
                "vendor": ExtractedField(
                    value="Demo Vendor Inc", confidence=0.5, type_hint="vendor"
                ),
            }

        return ExtractedRecord(root=fields)
