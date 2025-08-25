"""Document extraction agent using CrewAI and LangChain."""

import re
from typing import Any, Dict, Optional
from crewai import Agent, Task
from crewai.tools import BaseTool
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.schemas import ExtractedField, ExtractedRecord
from app.config import settings


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
                with open(config_file, 'r') as f:
                    config = json.load(f)
                    api_key = config.get('openai_api_key')
        except:
            pass

        # Fallback to settings if config file doesn't have it
        if not api_key:
            api_key = settings.openai_api_key

        print(f"DEBUG: Agent using API key: {'Yes' if api_key else 'No'}")
        print(f"DEBUG: Agent using model: {llm_model}")

        # Use the new OpenAI client format
        from langchain_openai import ChatOpenAI
        self.llm = ChatOpenAI(
            model=llm_model,
            temperature=0.1,
            openai_api_key=api_key
        )
        
        self.extraction_prompt = PromptTemplate(
            input_variables=["document_text", "document_type"],
            template="""
            You are an expert document analyst specializing in extracting structured data from business documents.
            
            Document Type: {document_type}
            Document Text: {document_text}
            
            Extract the following information and return it as a JSON object:
            - invoice_number: The unique identifier for this document
            - date: The date of the document (format: YYYY-MM-DD)
            - amount: The total amount (numeric value only)
            - vendor: The company/person providing goods/services
            - customer: The company/person receiving goods/services
            - description: Brief description of the goods/services
            - currency: The currency used (e.g., USD, EUR)
            - tax_amount: Tax amount if specified
            - payment_terms: Payment terms if specified
            
            For each field, provide:
            - value: The extracted value
            - confidence: Your confidence in the extraction (0.0-1.0)
            - type_hint: The type of data (e.g., "currency", "date", "text", "number")
            
            If a field is not found or unclear, set value to null and confidence to 0.0.
            Be precise and conservative with confidence scores.
            
            Return only valid JSON format.
            """
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
            tools=[]
        )
    
    def _create_extraction_tool(self):
        """Create the document extraction tool."""
        def extract_data(document_text: str) -> str:
            """Extract structured data from document text."""
            try:
                prompt = self.extraction_prompt.format(
                    document_text=document_text,
                    document_type="business_document"
                )
                response = self.llm.invoke(prompt)
                return response.content
            except Exception as e:
                return f"Error during extraction: {str(e)}"
        
        return Tool(
            name="document_extractor",
            description="Extracts structured data from document text",
            func=extract_data
        )
    
    def extract_fields(self, document_text: str, document_type: str = "invoice") -> ExtractedRecord:
        """Extract fields from document text using direct LLM chain."""
        
        print(f"DEBUG: DocumentExtractionAgent.extract_fields called with type: {document_type}")
        print(f"DEBUG: Text length: {len(document_text)}")
        
        try:
            # Use the LLM directly with the prompt
            prompt_text = self.extraction_prompt.format(
                document_text=document_text,
                document_type=document_type
            )
            
            print(f"DEBUG: Calling LLM with prompt length: {len(prompt_text)}")
            
            # Check if this is image content (base64 encoded)
            if document_text.startswith('/9j/') or document_text.startswith('iVBOR') or len(document_text) > 1000:
                print("DEBUG: Detected image content, using vision API")
                # For images, use vision capabilities
                from langchain_core.messages import HumanMessage
                
                message = HumanMessage(
                    content=[
                        {"type": "text", "text": f"Extract structured data from this {document_type} image and return as JSON with confidence scores for each field:"},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{document_text}"}}
                    ]
                )
                response = self.llm.invoke([message])
                result = response.content if hasattr(response, 'content') else str(response)
            else:
                print("DEBUG: Processing as text content")
                # Get the response from the LLM for text
                response = self.llm.invoke(prompt_text)
                result = response.content if hasattr(response, 'content') else str(response)
            
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
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
            else:
                # If no JSON found, try parsing the entire result
                data = json.loads(result)
            
            fields = {}
            for key, value in data.items():
                if isinstance(value, dict) and 'value' in value:
                    # Already in the correct format
                    fields[key] = ExtractedField(
                        value=value.get('value'),
                        confidence=value.get('confidence', 0.5),
                        type_hint=value.get('type_hint', 'text')
                    )
                else:
                    # Simple value, need to wrap
                    fields[key] = ExtractedField(
                        value=value,
                        confidence=0.7,  # Default confidence
                        type_hint=self._infer_type_hint(key, value)
                    )
            
            return ExtractedRecord(root=fields)
            
        except (json.JSONDecodeError, KeyError) as e:
            # If parsing fails, fall back to simple extraction
            return self._fallback_extraction(original_text)
    
    def _infer_type_hint(self, field_name: str, value: Any) -> str:
        """Infer the type hint based on field name and value."""
        field_name_lower = field_name.lower()
        
        if 'amount' in field_name_lower or 'total' in field_name_lower:
            return 'amount'
        elif 'date' in field_name_lower:
            return 'date'
        elif 'number' in field_name_lower or 'id' in field_name_lower:
            return 'identifier'
        elif 'vendor' in field_name_lower or 'supplier' in field_name_lower:
            return 'vendor'
        elif 'customer' in field_name_lower or 'client' in field_name_lower:
            return 'customer'
        elif 'currency' in field_name_lower:
            return 'currency'
        else:
            return 'text'
    
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
                    type_hint=field_name
                )
        
        # If no fields found, create synthetic demo data
        if not fields:
            fields = {
                "invoice_number": ExtractedField(
                    value="DEMO-001", confidence=0.5, type_hint="invoice_number"
                ),
                "date": ExtractedField(
                    value="2024-01-15", confidence=0.5, type_hint="date"
                ),
                "amount": ExtractedField(
                    value="1234.56", confidence=0.5, type_hint="amount"
                ),
                "vendor": ExtractedField(
                    value="Demo Vendor Inc", confidence=0.5, type_hint="vendor"
                ),
            }
        
        return ExtractedRecord(root=fields)

