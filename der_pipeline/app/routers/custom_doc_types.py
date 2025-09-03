from typing import List

from fastapi import APIRouter, HTTPException, status, Depends
from sqlmodel import Session, select
from loguru import logger

from ..db import get_session_sync
from ..models import CustomDocTypeDefinition
from ..utils.tenant import get_tenant_id

router = APIRouter(prefix="/doc-types", tags=["custom-doc-types"])

# Force reload marker - updated for custom schema extraction


def get_db():
    with get_session_sync() as session:
        yield session


@router.post("/", response_model=CustomDocTypeDefinition, status_code=status.HTTP_201_CREATED)
def create_doc_type(
    definition: CustomDocTypeDefinition, 
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id)
):
    definition.tenant_id = tenant_id
    db.add(definition)
    db.commit()
    db.refresh(definition)
    return definition

# Non-trailing-slash variants (to avoid 307s)
@router.post("", response_model=CustomDocTypeDefinition, status_code=status.HTTP_201_CREATED)
def create_doc_type_no_slash(
    definition: CustomDocTypeDefinition, 
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id)
):
    return create_doc_type(definition, db, tenant_id)


@router.get("/", response_model=List[CustomDocTypeDefinition])
def list_doc_types(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id)
):
    return db.exec(select(CustomDocTypeDefinition).where(CustomDocTypeDefinition.tenant_id == tenant_id)).all()

@router.get("", response_model=List[CustomDocTypeDefinition])
def list_doc_types_no_slash(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id)
):
    return list_doc_types(db, tenant_id)


@router.get("/{doc_type_id}", response_model=CustomDocTypeDefinition)
def get_doc_type(
    doc_type_id: int, 
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id)
):
    obj = db.exec(select(CustomDocTypeDefinition).where(
        CustomDocTypeDefinition.id == doc_type_id,
        CustomDocTypeDefinition.tenant_id == tenant_id
    )).first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doc type not found")
    return obj


@router.put("/{doc_type_id}", response_model=CustomDocTypeDefinition)
def update_doc_type(
    doc_type_id: int, 
    update: CustomDocTypeDefinition, 
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id)
):
    obj = db.exec(select(CustomDocTypeDefinition).where(
        CustomDocTypeDefinition.id == doc_type_id,
        CustomDocTypeDefinition.tenant_id == tenant_id
    )).first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doc type not found")
    update_data = update.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(obj, k, v)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{doc_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_doc_type(
    doc_type_id: int, 
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id)
):
    obj = db.exec(select(CustomDocTypeDefinition).where(
        CustomDocTypeDefinition.id == doc_type_id,
        CustomDocTypeDefinition.tenant_id == tenant_id
    )).first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doc type not found")
    db.delete(obj)
    db.commit()


@router.get("/templates")
def get_doc_type_templates():
    """Get predefined templates for common document types."""
    return {
        "invoice": {
            "name": "Invoice",
            "description": "Standard business invoice with line items",
            "extraction_type": "object",
            "output_schema": {
                "invoice_number": {"type": "string", "required": True},
                "vendor_name": {"type": "string", "required": True},
                "invoice_date": {"type": "date", "required": True},
                "due_date": {"type": "date", "required": False},
                "total_amount": {"type": "number", "required": True},
                "currency": {"type": "string", "required": True, "default": "USD"},
                "line_items": {"type": "array", "required": False, "items": {
                    "description": {"type": "string"},
                    "quantity": {"type": "number"},
                    "unit_price": {"type": "number"},
                    "total": {"type": "number"}
                }}
            },
            "instructions": {
                "prompt": "Extract invoice data including vendor, amounts, dates, and line items. Be precise with numbers and dates.",
                "extraction_hints": ["Look for invoice number at top", "Total amount usually at bottom right", "Line items in table format"]
            },
            "hil_instructions": {
                "required_review_fields": ["total_amount", "invoice_date", "vendor_name"],
                "validation_rules": ["total_amount > 0", "invoice_date is valid", "vendor_name not empty"]
            }
        },
        "receipt": {
            "name": "Receipt",
            "description": "Store receipt with purchased items",
            "extraction_type": "object",
            "output_schema": {
                "merchant_name": {"type": "string", "required": True},
                "transaction_date": {"type": "date", "required": True},
                "total_amount": {"type": "number", "required": True},
                "currency": {"type": "string", "required": True, "default": "USD"},
                "payment_method": {"type": "string", "required": False},
                "items": {"type": "array", "required": False, "items": {
                    "name": {"type": "string"},
                    "price": {"type": "number"},
                    "quantity": {"type": "number"}
                }}
            },
            "instructions": {
                "prompt": "Extract receipt data including merchant, total, date, and itemized purchases.",
                "extraction_hints": ["Merchant name at top", "Total at bottom", "Items listed in middle"]
            },
            "hil_instructions": {
                "required_review_fields": ["total_amount", "merchant_name"],
                "validation_rules": ["total_amount > 0", "merchant_name not empty"]
            }
        },
        "expense_form": {
            "name": "Expense Form",
            "description": "Employee expense reimbursement form",
            "extraction_type": "object",
            "output_schema": {
                "employee_name": {"type": "string", "required": True},
                "employee_id": {"type": "string", "required": False},
                "expense_date": {"type": "date", "required": True},
                "expense_category": {"type": "string", "required": True},
                "amount": {"type": "number", "required": True},
                "currency": {"type": "string", "required": True, "default": "USD"},
                "description": {"type": "string", "required": True},
                "receipt_attached": {"type": "boolean", "required": False}
            },
            "instructions": {
                "prompt": "Extract expense form data including employee info, expense details, and amounts.",
                "extraction_hints": ["Employee name/ID at top", "Expense category and description", "Amount and date"]
            },
            "hil_instructions": {
                "required_review_fields": ["amount", "expense_category", "employee_name"],
                "validation_rules": ["amount > 0", "expense_category not empty", "employee_name not empty"]
            }
        }
    }


@router.post("/{doc_type_id}/test")
def test_extraction(
    doc_type_id: int, 
    test_data: dict, 
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id)
):
    """Test extraction settings with sample document content."""
    logger.info(f"Test extraction called for doc_type_id: {doc_type_id}, tenant_id: {tenant_id}")
    
    doc_type = db.exec(select(CustomDocTypeDefinition).where(
        CustomDocTypeDefinition.id == doc_type_id,
        CustomDocTypeDefinition.tenant_id == tenant_id
    )).first()
    
    logger.info(f"Found doc_type: {doc_type.name if doc_type else 'None'}")
    
    if not doc_type:
        raise HTTPException(status_code=404, detail="Doc type not found")
    
    # Simulate extraction using the doc type's custom schema
    
    sample_text = test_data.get("sample_text", "")
    if not sample_text:
        raise HTTPException(status_code=400, detail="sample_text required")
    
    try:
        logger.info(f"Starting custom schema extraction for doc_type: {doc_type.name}")
        logger.info(f"Schema: {doc_type.output_schema}")
        logger.info(f"Sample text length: {len(sample_text)}")
        
        # Use custom schema-aware extraction
        extracted_data = _extract_with_custom_schema(sample_text, doc_type)
        
        logger.info(f"Custom extraction completed, got {len(extracted_data)} fields")
        
        return {
            "doc_type_id": doc_type_id,
            "extracted_fields": extracted_data,
            "schema_compliance": _validate_against_schema(extracted_data, doc_type.output_schema),
            "test_status": "success"
        }
    except Exception as e:
        logger.error(f"Custom schema extraction failed: {e}")
        logger.exception("Full traceback:")
        return {
            "doc_type_id": doc_type_id,
            "error": str(e),
            "test_status": "failed"
        }


def _extract_with_custom_schema(sample_text: str, doc_type) -> dict:
    """Extract data using the document type's custom schema and instructions."""
    import json
    import openai
    import base64
    from ..config import settings
    
    if not settings.openai_api_key:
        logger.warning("OpenAI API key not configured, returning empty extraction")
        return {}

    # Check if the sample_text is base64 encoded image data
    is_image = False
    if sample_text.startswith('/9j/') or sample_text.startswith('iVBORw0KGgo') or sample_text.startswith('UklGR'):
        logger.info("Detected base64 image data, will use GPT-4 Vision to extract text first")
        is_image = True
        # Keep original base64 data for vision processing
        image_data = sample_text
    else:
        # Truncate text if too long to avoid token limits
        max_chars = 20000  # Increased limit for better extraction
        if len(sample_text) > max_chars:
            logger.warning(f"Text too long ({len(sample_text)} chars), truncating to {max_chars} chars")
            # Take from middle and end to get more relevant content
            sample_text = sample_text[:max_chars//2] + "\n\n[TRUNCATED...]\n\n" + sample_text[-max_chars//2:]

    # Build custom prompt based on schema
    if not doc_type.output_schema or not isinstance(doc_type.output_schema, dict):
        logger.warning(f"Invalid or missing schema for doc_type {doc_type.name}: {doc_type.output_schema}")
        return {}
    
    schema_example = _build_schema_example(doc_type.output_schema)
    
    # Use custom instructions if available, otherwise create generic ones
    extraction_instructions = ""
    if doc_type.instructions and doc_type.instructions.get("prompt"):
        extraction_instructions = doc_type.instructions["prompt"]
    else:
        extraction_instructions = f"Extract structured data from this {doc_type.name} document."
    
    # Create vision-optimized prompt if processing images
    if is_image:
        system_prompt = f"""You are an expert at extracting structured data from document images using computer vision.

CRITICAL: Return ONLY a valid JSON object. Do NOT use markdown code blocks (```json), do NOT add explanations, do NOT add any text before or after the JSON.

Document Type: {doc_type.name}
Description: {doc_type.description or 'Custom document type'}

Vision Extraction Instructions: {extraction_instructions}

Look carefully at the document image and extract the following fields with high accuracy:

Required Output Format (extract these exact fields):
{schema_example}

Vision Processing Rules:
- Carefully examine all text in the image, including small print
- For receipts/invoices: look for amounts in the bottom-right area, dates at the top
- For handwritten text: use context clues and common patterns
- Extract data according to the schema above
- Use null for missing or unreadable fields
- For arrays, extract all visible items
- Confidence should reflect how clearly you can read each field (0.0-1.0)
- Return ONLY the JSON object, nothing else
- NO markdown formatting, NO code blocks, NO explanatory text
- Start your response directly with {{ and end with }}"""
    else:
        system_prompt = f"""You are an expert at extracting structured data from documents.

CRITICAL: Return ONLY a valid JSON object. Do NOT use markdown code blocks (```json), do NOT add explanations, do NOT add any text before or after the JSON.

Document Type: {doc_type.name}
Description: {doc_type.description or 'Custom document type'}

Extraction Instructions: {extraction_instructions}

Required Output Format (extract these exact fields):
{schema_example}

Rules:
- Extract data according to the schema above
- Use null for missing fields
- For arrays, extract all items you can find
- For objects, extract all nested properties
- Confidence should be 0.0-1.0 based on certainty
- Return ONLY the JSON object, nothing else
- NO markdown formatting, NO code blocks, NO explanatory text
- Start your response directly with {{ and end with }}"""

    logger.info(f"SYSTEM PROMPT: {system_prompt}")
    
    if is_image:
        # Determine image format from base64 header first
        image_format = "jpeg"  # default
        if image_data.startswith('iVBORw0KGgo'):
            image_format = "png"
        elif image_data.startswith('UklGR'):
            image_format = "webp"
            
        logger.info(f"Processing image data (base64 length: {len(image_data)} chars)")
        logger.info(f"Image format detected: {image_format}")
    else:
        logger.info(f"SAMPLE TEXT (first 1000 chars): {sample_text[:1000]}")
        logger.info(f"SAMPLE TEXT (last 1000 chars): {sample_text[-1000:]}")

    try:
        client = openai.OpenAI(api_key=settings.openai_api_key)
        
        if is_image:
            # Use GPT-4 Vision for image processing
            logger.info("Using GPT-4 Vision for image-based extraction")
            
            response = client.chat.completions.create(
                model="gpt-4o",  # Use GPT-4o for vision capabilities
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Extract fields from this {doc_type.name} document image and return ONLY a valid JSON object:"
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
                temperature=settings.llm_temperature or 0.1,
                max_tokens=settings.llm_max_tokens or 2000,
            )
        else:
            # Use standard text processing
            response = client.chat.completions.create(
                model=settings.llm_model or "gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Extract fields from this document and return ONLY a valid JSON object:\n\n{sample_text}"},
                ],
                temperature=settings.llm_temperature or 0.1,
                max_tokens=settings.llm_max_tokens or 2000,
            )

        content = response.choices[0].message.content
        logger.info(f"Custom schema extraction response: {content[:500]}...")
        logger.info(f"FULL LLM RESPONSE: {content}")
        
        # Parse JSON response
        try:
            extracted_data = json.loads(content)
            logger.info(f"Successfully parsed JSON with {len(extracted_data)} fields")
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            logger.error(f"Failed content: {content}")
            # Try to extract JSON from markdown code blocks or find JSON within the response
            import re
            
            # First try to extract from markdown code blocks
            markdown_match = re.search(r'```(?:json)?\s*(\{.*\})\s*```', content, re.DOTALL)
            if markdown_match:
                json_str = markdown_match.group(1).strip()
                logger.info(f"Found JSON in markdown block: {json_str[:200]}...")
            else:
                # Fallback to finding JSON within the response
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0).strip()
                    logger.info(f"Found JSON match: {json_str[:200]}...")
                else:
                    logger.error(f"No valid JSON found in custom extraction response")
                    logger.error(f"Full response: {content}")
                    return {"error": "No JSON found in response"}
            
            try:
                extracted_data = json.loads(json_str)
                logger.info(f"Successfully parsed extracted JSON with {len(extracted_data)} fields")
            except json.JSONDecodeError as e2:
                logger.error(f"Even extracted JSON failed: {e2}")
                logger.error(f"Extracted JSON: {json_str}")
                return {"error": f"JSON parsing failed: {e2}"}

        # Ensure each field has value and confidence format
        result = {}
        logger.info(f"Processing {len(extracted_data)} fields from extraction")
        for field, data in extracted_data.items():
            logger.info(f"Processing field '{field}': {data}")
            if isinstance(data, dict) and "value" in data:
                result[field] = {"value": data["value"], "confidence": data.get("confidence", 0.8)}
                logger.info(f"Field '{field}' has value: {data['value']}")
            else:
                # Handle simple value format
                result[field] = {"value": data, "confidence": 0.8}
                logger.info(f"Field '{field}' simple value: {data}")

        logger.info(f"Final result has {len(result)} fields")
        return result

    except Exception as e:
        logger.error(f"Custom schema extraction failed: {e}")
        logger.exception("Full traceback:")
        return {"error": f"Extraction failed: {str(e)}"}


def _build_schema_example(schema: dict) -> str:
    """Build an example JSON structure based on the schema."""
    import json
    
    logger.info(f"Building schema example from: {schema}")
    def build_example_value(field_def):
        field_type = field_def.get("type", "string")
        description = field_def.get("description", "")
        
        if field_type == "string":
            return {"value": "...", "confidence": 0.9}
        elif field_type == "number":
            return {"value": 0.0, "confidence": 0.9}
        elif field_type == "date":
            return {"value": "YYYY-MM-DD", "confidence": 0.9}
        elif field_type == "boolean":
            return {"value": True, "confidence": 0.9}
        elif field_type == "array":
            items_def = field_def.get("items", {})
            if items_def.get("type") == "object" and items_def.get("properties"):
                # Array of objects
                example_item = {}
                for prop_name, prop_def in items_def["properties"].items():
                    example_item[prop_name] = build_example_value(prop_def)
                return {"value": [example_item], "confidence": 0.9}
            else:
                # Array of primitives
                item_type = items_def.get("type", "string")
                if item_type == "string":
                    return {"value": ["item1", "item2"], "confidence": 0.9}
                elif item_type == "number":
                    return {"value": [1.0, 2.0], "confidence": 0.9}
                else:
                    return {"value": ["..."], "confidence": 0.9}
        elif field_type == "object":
            properties = field_def.get("properties", {})
            example_obj = {}
            for prop_name, prop_def in properties.items():
                example_obj[prop_name] = build_example_value(prop_def)
            return {"value": example_obj, "confidence": 0.9}
        else:
            return {"value": "...", "confidence": 0.9}
    
    example = {}
    for field_name, field_def in schema.items():
        example[field_name] = build_example_value(field_def)
    
    return json.dumps(example, indent=2)


def _validate_against_schema(extracted: dict, schema: dict) -> dict:
    """Validate extracted data against output schema."""
    compliance = {"valid": True, "missing_required": [], "type_mismatches": []}
    
    for field_name, field_def in schema.items():
        if field_def.get("required", False) and field_name not in extracted:
            compliance["missing_required"].append(field_name)
            compliance["valid"] = False
            
        if field_name in extracted:
            expected_type = field_def.get("type", "string")
            value = extracted[field_name].get("value") if isinstance(extracted[field_name], dict) else extracted[field_name]
            
            if expected_type == "number" and not isinstance(value, (int, float)):
                compliance["type_mismatches"].append(f"{field_name}: expected number, got {type(value).__name__}")
                compliance["valid"] = False
    
    return compliance
