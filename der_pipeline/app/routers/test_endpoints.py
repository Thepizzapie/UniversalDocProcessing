"""Test endpoints for document processing."""

from typing import Any
import logging

from fastapi import APIRouter, HTTPException, status

from ..services.extraction import extract_structured_data

logger = logging.getLogger(__name__)
router = APIRouter(tags=["testing"])


@router.post("/test-extraction")
async def test_extraction(request: dict[str, Any]):
    """Test extraction with a temporary configuration without saving."""
    
    sample_text = request.get("sample_text")
    test_config = request.get("test_config")
    
    # Debug logging to see what we're getting
    logger.info(f"Test extraction request - sample_text length: {len(sample_text) if sample_text else 0}")
    logger.info(f"Test config keys: {list(test_config.keys()) if test_config else 'None'}")
    
    if not sample_text or not test_config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sample_text and test_config are required"
        )
    
    # Extract instructions and output_schema from ANY possible structure
    instructions = {}
    output_schema = {}
    
    # Method 1: Check if it's in objects array (new format)
    if "objects" in test_config and test_config["objects"]:
        logger.info(f"Found objects array with {len(test_config['objects'])} items")
        first_object = test_config["objects"][0]
        logger.info(f"First object keys: {list(first_object.keys())}")
        
        output_schema = first_object.get("object_schema", {})
        extraction_instructions = first_object.get("extraction_instructions", "")
        instructions = {"extraction_instructions": extraction_instructions}
        
        logger.info(f"From objects - output_schema keys: {list(output_schema.keys()) if output_schema else 'None'}")
        logger.info(f"From objects - extraction_instructions: {extraction_instructions[:100] if extraction_instructions else 'None'}")
    
    # Method 2: Check top level (old format)
    elif "instructions" in test_config and "output_schema" in test_config:
        logger.info("Using top-level instructions and output_schema")
        instructions = test_config["instructions"]
        output_schema = test_config["output_schema"]
    
    # Method 3: Check if output_schema is directly at top level
    elif "output_schema" in test_config:
        logger.info("Found output_schema at top level")
        output_schema = test_config["output_schema"]
        instructions = {"extraction_instructions": "Extract the specified fields from the document"}
    
    # Method 4: Emergency fallback - create a simple schema from any data we can find
    else:
        logger.warning("No schema found in expected locations, dumping full test_config structure:")
        logger.warning(f"Full test_config: {test_config}")
        
        # Try to create a basic schema if there's any hint of fields
        output_schema = {
            "properties": {
                "field1": {"type": "string", "description": "Example field"},
                "field2": {"type": "string", "description": "Another field"}
            }
        }
        instructions = {"extraction_instructions": "Extract any relevant data from the document"}
    
    logger.info(f"Final output_schema properties: {list(output_schema.get('properties', {}).keys())}")
    
    # Normalize schema format - convert direct field format to JSON Schema format
    if output_schema and not output_schema.get("properties"):
        # If output_schema has fields directly (like {field_name: {type: ...}})
        # Convert to JSON Schema format: {properties: {field_name: {type: ...}}}
        if output_schema and any(isinstance(v, dict) and "type" in v for v in output_schema.values()):
            logger.info("Converting direct field format to JSON Schema format")
            output_schema = {
                "type": "object",
                "properties": output_schema
            }
    
    # Check if we have valid schema
    schema_properties = output_schema.get("properties", {}) if output_schema else {}
    if not schema_properties:
        logger.error("Still no valid output schema found after all attempts")
        logger.error(f"output_schema structure: {output_schema}")
        return {
            "test_status": "failed",
            "error": "No fields defined in output schema",
            "suggestion": "Please add field definitions to your output schema before testing extraction. Go to the 'Output Schema' step and define the fields you want to extract.",
            "helpful_tips": [
                "Click 'Add Field' to define what data you want to extract",
                "Each field should have a name and description",
                "Common fields include: company_name, total_amount, date, etc."
            ],
            "debug_info": {
                "test_config_keys": list(test_config.keys()),
                "has_objects": "objects" in test_config,
                "objects_count": len(test_config.get("objects", [])),
                "has_output_schema": "output_schema" in test_config,
                "output_schema_structure": str(output_schema)[:500] if output_schema else "None"
            }
        }
    
    try:
        # Create a temporary document for testing
        test_document = {
            "id": 0,  # Temporary ID
            "content": sample_text,
            "tenant_id": 1  # Default tenant for testing
        }
        
        logger.info(f"Starting extraction test with {len(schema_properties)} fields")
        
        # Test the extraction with the provided configuration
        result = await extract_structured_data(
            document=test_document,
            instructions=instructions,
            output_schema=output_schema
        )
        
        # Check if result contains error
        if "error" in result:
            return {
                "test_status": "failed",
                "error": result["error"],
                "suggestion": result.get("suggestion", "Please check your configuration and try again"),
                "helpful_tips": result.get("helpful_tips", [])
            }
        
        # Return successful result with enhanced data
        return {
            "test_status": "success",
            "extracted_data": result.get("extracted_data", {}),
            "summary": result.get("summary", {}),
            "confidence": result.get("summary", {}).get("success_rate", 0) / 100,  # Convert to 0-1 scale
            "processing_time": 0.5,  # Mock processing time for now
            "fields_tested": len(output_schema.get("properties", {})),
            "helpful_tips": _get_helpful_tips(result)
        }
        
    except Exception as e:
        logger.error(f"Extraction test failed with exception: {e}")
        return {
            "test_status": "failed",
            "error": str(e),
            "suggestion": "An unexpected error occurred. Please check your document and configuration.",
            "extracted_data": None
        }


def _get_helpful_tips(result: dict) -> list[str]:
    """Generate helpful tips based on extraction results."""
    tips = []
    
    if "summary" in result:
        summary = result["summary"]
        success_rate = summary.get("success_rate", 0)
        
        if success_rate == 0:
            tips.append("No fields were extracted. Try using more specific field names or check if your document contains the expected data.")
        elif success_rate < 50:
            tips.append("Some fields were found but many were missing. Consider refining your field descriptions or using more descriptive field names.")
        elif success_rate < 80:
            tips.append("Good extraction rate! You might improve results by adding more specific instructions for the missing fields.")
        else:
            tips.append("Excellent extraction rate! Your configuration looks good.")
        
        if "extracted_data" in result:
            extracted_data = result["extracted_data"]
            low_confidence_fields = [
                field for field, data in extracted_data.items() 
                if isinstance(data, dict) and data.get("confidence", 0) < 0.7
            ]
            
            if low_confidence_fields:
                tips.append(f"Low confidence on fields: {', '.join(low_confidence_fields)}. Consider adding more specific extraction instructions.")
    
    return tips
