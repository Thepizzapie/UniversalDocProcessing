"""LLM extraction interface and implementations."""

import json
from typing import Any

import openai
from loguru import logger

from ..config import settings


def extract_fields(text: str, doc_type: str, model: str | None = None) -> dict[str, Any]:
    """Extract fields using OpenAI API with vision support.

    Args:
        text: Document text to extract from (or base64 image data)
        doc_type: Type of document (invoice, receipt, etc.)
        model: OpenAI model to use (defaults to settings.llm_model)

    Returns:
        Dict mapping field names to {value, confidence} dicts
    """
    if not settings.openai_api_key:
        logger.warning("OpenAI API key not configured, returning empty extraction")
        return {}

    # Check if the text is base64 encoded image data
    is_image = False
    image_data = None
    if text.startswith('/9j/') or text.startswith('iVBORw0KGgo') or text.startswith('UklGR'):
        logger.info("Detected base64 image data, will use GPT-4 Vision for extraction")
        is_image = True
        image_data = text
        model = "gpt-4o"  # Force GPT-4o for vision processing
    else:
        # Truncate text if too long to avoid token limits
        max_chars = 8000  # Roughly 2000 tokens, leaving room for prompt
        if len(text) > max_chars:
            logger.warning(f"Text too long ({len(text)} chars), truncating to {max_chars} chars")
            text = text[:max_chars] + "\n\n[TRUNCATED...]"

    model = model or settings.llm_model

    # Configure OpenAI client
    client = openai.OpenAI(api_key=settings.openai_api_key)

    # Create document type specific prompts
    prompts = {
        "invoice": _get_invoice_prompt(),
        "receipt": _get_receipt_prompt(),
        "entry_exit_log": _get_entry_exit_log_prompt(),
        "unknown": _get_generic_prompt(),
    }

    system_prompt = prompts.get(doc_type.lower(), prompts["unknown"])

    try:
        if is_image:
            # Determine image format from base64 header
            image_format = "jpeg"  # default
            if image_data.startswith('iVBORw0KGgo'):
                image_format = "png"
            elif image_data.startswith('UklGR'):
                image_format = "webp"
                
            logger.info(f"Using GPT-4 Vision for {doc_type} extraction with {image_format} image")
            
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Extract fields from this {doc_type} document image and return ONLY a valid JSON object with no additional text or explanation:"
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/{image_format};base64,{image_data}",
                                    "detail": "high"
                                }
                            }
                        ]
                    }
                ],
                temperature=settings.llm_temperature,
                max_tokens=settings.llm_max_tokens,
            )
        else:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Extract fields from this document and return ONLY a valid JSON object with no additional text or explanation:\n\n{text}"},
                ],
                temperature=settings.llm_temperature,
                max_tokens=settings.llm_max_tokens,
            )

        # Parse the JSON response
        content = response.choices[0].message.content
        logger.info(f"LLM response content: {content[:500]}...")  # Log first 500 chars for debugging
        
        # Try to extract JSON from the response (sometimes LLM adds explanatory text)
        try:
            extracted_data = json.loads(content)
        except json.JSONDecodeError:
            # Try to find JSON within the response
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                extracted_data = json.loads(json_str)
            else:
                logger.error(f"No valid JSON found in LLM response: {content}")
                return {}

        # Ensure each field has value and confidence
        result = {}
        for field, data in extracted_data.items():
            if isinstance(data, dict) and "value" in data:
                result[field] = {"value": data["value"], "confidence": data.get("confidence", 0.8)}
            else:
                # Handle simple value format
                result[field] = {"value": data, "confidence": 0.8}

        return result

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {e}")
        return {}
    except Exception as e:
        logger.error(f"LLM extraction failed: {e}")
        return {}


def _get_invoice_prompt() -> str:
    """Get system prompt for invoice extraction."""
    return """You are an expert at extracting structured data from invoices.

IMPORTANT: Return ONLY a valid JSON object with no additional text, explanations, or markdown formatting.

Extract the following fields and return as JSON:

{
  "invoice_number": {"value": "...", "confidence": 0.9},
  "vendor_name": {"value": "...", "confidence": 0.9},
  "vendor_address": {"value": "...", "confidence": 0.8},
  "vendor_tax_id": {"value": "...", "confidence": 0.8},
  "invoice_date": {"value": "YYYY-MM-DD", "confidence": 0.9},
  "due_date": {"value": "YYYY-MM-DD", "confidence": 0.8},
  "subtotal": {"value": 100.00, "confidence": 0.9},
  "tax_amount": {"value": 10.00, "confidence": 0.8},
  "total_amount": {"value": 110.00, "confidence": 0.9},
  "currency": {"value": "USD", "confidence": 0.9},
  "payment_terms": {"value": "...", "confidence": 0.7}
}

Rules:
- Use null for missing fields
- Confidence should be 0.0-1.0 based on certainty
- Return only the JSON object, nothing else"""


def _get_receipt_prompt() -> str:
    """Get system prompt for receipt extraction."""
    return """You are an expert at extracting structured data from receipts using computer vision.

IMPORTANT: Return ONLY a valid JSON object with no additional text, explanations, or markdown formatting.

For receipt images, look carefully at all text including:
- Store name (usually at the top)
- Date and time (often near the top)
- Amounts (total usually at bottom-right)
- Tax information
- Payment method details

Extract the following fields and return as JSON:

{
  "merchant_name": {"value": "...", "confidence": 0.9},
  "merchant_address": {"value": "...", "confidence": 0.8},
  "transaction_date": {"value": "YYYY-MM-DD", "confidence": 0.9},
  "transaction_time": {"value": "HH:MM:SS", "confidence": 0.8},
  "total_amount": {"value": 25.50, "confidence": 0.9},
  "tax_amount": {"value": 2.30, "confidence": 0.8},
  "currency": {"value": "USD", "confidence": 0.9},
  "payment_method": {"value": "...", "confidence": 0.8},
  "receipt_number": {"value": "...", "confidence": 0.8}
}

Rules:
- Use null for missing or unreadable fields
- Confidence should be 0.0-1.0 based on how clearly you can read the text
- Return only the JSON object, nothing else"""


def _get_entry_exit_log_prompt() -> str:
    """Get system prompt for entry/exit log extraction."""
    return """You are an expert at extracting structured data from entry/exit logs.
Extract the following fields and return as JSON:

{
  "person_name": {"value": "...", "confidence": 0.9},
  "person_id": {"value": "...", "confidence": 0.8},
  "entry_time": {"value": "YYYY-MM-DD HH:MM:SS", "confidence": 0.9},
  "exit_time": {"value": "YYYY-MM-DD HH:MM:SS", "confidence": 0.9},
  "location": {"value": "...", "confidence": 0.9},
  "purpose": {"value": "...", "confidence": 0.7},
  "authorized_by": {"value": "...", "confidence": 0.8},
  "badge_number": {"value": "...", "confidence": 0.8},
  "vehicle_info": {"value": "...", "confidence": 0.7}
}

Use null for missing fields. Confidence should be 0.0-1.0 based on how certain you are."""


def _get_generic_prompt() -> str:
    """Get system prompt for generic document extraction."""
    return """You are an expert at extracting structured data from documents.

IMPORTANT: Return ONLY a valid JSON object with no additional text, explanations, or markdown formatting.

Analyze the document and extract relevant key-value pairs as JSON:

{
  "field_name": {"value": "...", "confidence": 0.8},
  "another_field": {"value": "...", "confidence": 0.9}
}

Rules:
- Extract fields that seem relevant based on the document content
- Use descriptive field names
- Confidence should be 0.0-1.0 based on certainty
- Return only the JSON object, nothing else
- Do not include any explanatory text before or after the JSON"""


def extract_fields_with_custom_instructions(
    text: str, 
    expected_fields: list[str], 
    custom_instructions: dict, 
    output_schema: dict,
    model: str | None = None
) -> dict[str, Any]:
    """Extract fields using custom instructions and schema.
    
    Args:
        text: Document text to extract from (or base64 image data)
        expected_fields: List of field names to extract
        custom_instructions: Custom extraction instructions
        output_schema: JSON schema defining the expected output structure
        model: OpenAI model to use (defaults to settings.llm_model)
    
    Returns:
        Dict mapping field names to {value, confidence} dicts
    """
    if not settings.openai_api_key:
        logger.warning("OpenAI API key not configured, returning empty extraction")
        return {}

    # Check if the text is base64 encoded image data
    is_image = False
    image_data = None
    if text.startswith('/9j/') or text.startswith('iVBORw0KGgo') or text.startswith('UklGR'):
        logger.info("Detected base64 image data, using vision API for custom extraction")
        is_image = True
        image_data = text
        model = "gpt-4o"  # Force GPT-4o for vision processing
    else:
        # Truncate text if too long to avoid token limits
        max_chars = 8000  # Roughly 2000 tokens, leaving room for prompt
        if len(text) > max_chars:
            logger.warning(f"Text too long ({len(text)} chars), truncating to {max_chars} chars")
            text = text[:max_chars] + "\n\n[TRUNCATED...]"

    model = model or settings.llm_model

    # Configure OpenAI client
    client = openai.OpenAI(api_key=settings.openai_api_key)

    # Build custom prompt based on instructions and schema
    logger.info(f"DEBUG: Custom extraction - expected_fields: {expected_fields}")
    logger.info(f"DEBUG: Custom extraction - output_schema keys: {list(output_schema.keys()) if isinstance(output_schema, dict) else 'Not a dict'}")
    if isinstance(output_schema, dict) and "properties" in output_schema:
        logger.info(f"DEBUG: Schema properties keys: {list(output_schema['properties'].keys())}")
    logger.info(f"DEBUG: Custom extraction - custom_instructions: {custom_instructions}")
    if isinstance(output_schema, dict) and "properties" in output_schema:
        logger.info(f"DEBUG: Full schema being sent to LLM:")
        for field_name, field_def in output_schema["properties"].items():
            logger.info(f"  - {field_name}: {field_def.get('description', 'no description')}")

    field_descriptions: list[str] = []
    expected_json_hint = None
    if isinstance(output_schema, dict):
        # Special handling for combined dual-package schema: { parent: {...}, children: {...} }
        if "parent" in output_schema and "children" in output_schema:
            parent_schema = output_schema.get("parent") or {}
            child_schema = output_schema.get("children") or {}
            def list_fields(schema_obj: dict) -> dict:
                if isinstance(schema_obj, dict) and "properties" in schema_obj and isinstance(schema_obj.get("properties"), dict):
                    return schema_obj["properties"]
                return schema_obj if isinstance(schema_obj, dict) else {}
            parent_props = list_fields(parent_schema)
            child_props = list_fields(child_schema)

            # Build descriptions for both
            field_descriptions.append('Parent object fields:')
            for field_name, field_info in parent_props.items():
                if isinstance(field_info, dict):
                    description = field_info.get("description", f"Extract {field_name}")
                    field_type = field_info.get("type", "string")
                    example = field_info.get("example", f"<{field_type}_value>")
                else:
                    description = f"Extract {field_name}"
                    example = "<string_value>"
                field_descriptions.append(f'  parent.{field_name}: {example} // {description}')

            field_descriptions.append('Children array item fields:')
            for field_name, field_info in child_props.items():
                if isinstance(field_info, dict):
                    description = field_info.get("description", f"Extract {field_name}")
                    field_type = field_info.get("type", "string")
                    example = field_info.get("example", f"<{field_type}_value>")
                else:
                    description = f"Extract {field_name}"
                    example = "<string_value>"
                field_descriptions.append(f'  children[].{field_name}: {example} // {description}')

            expected_json_hint = '{"parent": { ...object fields... }, "children": [{ ...array item fields... }]}'
        else:
            if "properties" in output_schema and isinstance(output_schema.get("properties"), dict):
                props = output_schema["properties"]
                logger.info(f"DEBUG: Using JSON Schema properties: {list(props.keys())}")
            else:
                # Treat flat dict as properties-like
                props = output_schema
                logger.info(f"DEBUG: Using flat schema properties: {list(props.keys())}")
            for field_name, field_info in props.items():
                if isinstance(field_info, dict):
                    description = field_info.get("description", f"Extract {field_name}")
                    field_type = field_info.get("type", "string")
                    example = field_info.get("example", f"<{field_type}_value>")
                else:
                    description = f"Extract {field_name}"
                    field_type = "string"
                    example = "<string_value>"
                field_descriptions.append(f'  "{field_name}": {{"value": "{example}", "confidence": 0.9}} // {description}')
    else:
        logger.warning(f"DEBUG: output_schema is not a dict: {type(output_schema)}")

    # Normalize instructions input
    extraction_instructions = "Extract the specified fields from the document."
    if isinstance(custom_instructions, dict):
        extraction_instructions = custom_instructions.get('extraction_instructions') or custom_instructions.get('prompt') or extraction_instructions
    elif isinstance(custom_instructions, str):
        extraction_instructions = custom_instructions or extraction_instructions
    
    custom_prompt = f"""You are an expert at extracting structured data from documents.

CUSTOM EXTRACTION INSTRUCTIONS:
{extraction_instructions}

IMPORTANT RULES:
- Return ONLY a valid JSON object with no additional text, explanations, or markdown formatting
- Extract ONLY the fields specified below
- Use null for missing fields (don't guess or make up values)
- Confidence should be 0.0-1.0 based on how certain you are about the extracted value
- For dates, use ISO format (YYYY-MM-DD) when possible
- For numbers, extract as numbers not strings when appropriate

REQUIRED FIELDS TO EXTRACT:
{chr(10).join(field_descriptions)}

Expected JSON format:
{expected_json_hint if expected_json_hint else '{\n' + chr(10).join(field_descriptions) + '\n}'}

Remember: Return ONLY the JSON object, nothing else."""

    try:
        if is_image:
            # Use vision API for image processing
            messages = [
                {
                    "role": "system",
                    "content": custom_prompt
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Please extract the specified fields from this document image:"
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_data}"
                            }
                        }
                    ]
                }
            ]
        else:
            # Use text-based processing
            messages = [
                {"role": "system", "content": custom_prompt},
                {"role": "user", "content": f"Document content:\n\n{text}"}
            ]

        logger.info(f"Calling {model} for custom extraction with {len(expected_fields)} fields")
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.1,
            max_tokens=2000
        )

        result_text = response.choices[0].message.content.strip()
        logger.info(f"Custom extraction response length: {len(result_text)}")

        # Clean the response (remove markdown code blocks if present)
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.startswith("```"):
            result_text = result_text[3:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]

        result_text = result_text.strip()

        # Parse JSON response
        try:
            extracted_data = json.loads(result_text)
            logger.info(f"Successfully parsed custom extraction result with {len(extracted_data)} fields")
            return extracted_data
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse custom extraction JSON: {e}")
            logger.error(f"Raw response: {result_text}")
            return {}

    except Exception as e:
        logger.error(f"Custom extraction failed: {e}")
        return {}
