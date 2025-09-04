"""AI/ML health check endpoints."""

from typing import Any

from fastapi import APIRouter

from ..services.crewai_service import crewai_service

router = APIRouter()


@router.get("/ai-health", response_model=dict[str, Any])
async def ai_health_check():
    """Check the health of AI/ML components (CrewAI, LangChain)."""
    health_status = crewai_service.health_check()

    return {
        "status": "available" if crewai_service.is_enabled else "unavailable",
        "openai_status": "available" if crewai_service.is_enabled else "unavailable",
        "crewai_status": "available" if crewai_service.is_enabled else "unavailable",
        "message": health_status.get("message", "AI service status checked"),
    }


@router.get("/ai-health/status", response_model=dict[str, Any])
async def ai_status():
    """Get detailed status of AI/ML services."""
    return {
        "crewai_service": crewai_service.get_service_status(),
        "enabled": crewai_service.is_enabled,
        "available": crewai_service.is_enabled,
    }


@router.post("/ai-health/test")
async def test_ai_extraction(request: dict = None):
    """Test AI extraction capabilities."""
    if not crewai_service.is_enabled:
        return {"status": "disabled", "message": "CrewAI service is not enabled"}

    # Get test text from request or use default
    test_text = "Invoice #TEST-001 Date: 2024-01-01 Amount: $100.00"
    if request and "test_text" in request:
        test_text = request["test_text"]

    try:
        result = crewai_service.extract_document_data(test_text, "test")
        return {
            "status": "success",
            "extraction_result": result.root if result else None,
            "fields_extracted": len(result.root) if result else 0,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


@router.post("/ai-health/generate-schema")
async def generate_ai_schema(request: dict):
    """Generate a JSON schema using AI based on document description."""
    if not crewai_service.is_enabled:
        return {
            "status": "disabled",
            "message": "CrewAI service is not enabled",
            "schema": None
        }

    # Validate request
    if not request or "document_description" not in request:
        return {
            "status": "error",
            "message": "Missing document_description in request",
            "schema": None
        }

    document_description = request["document_description"].strip()
    document_type = request.get("document_type", "custom")

    if not document_description:
        return {
            "status": "error",
            "message": "Document description cannot be empty",
            "schema": None
        }

    try:
        # Generate schema using AI
        generated_schema = crewai_service.generate_document_schema(
            document_description=document_description,
            document_type=document_type
        )

        if generated_schema:
            return {
                "status": "success",
                "message": f"Successfully generated schema for {document_type}",
                "schema": generated_schema,
                "field_count": len(generated_schema.get("properties", {}))
            }
        else:
            return {
                "status": "error",
                "message": "AI schema generation failed - no schema returned",
                "schema": None
            }

    except Exception as e:
        return {
            "status": "error",
            "message": f"AI schema generation failed: {str(e)}",
            "schema": None
        }