"""Custom pipeline configuration API routes."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..db import get_session_sync
from ..models import CustomDocTypeDefinition
from ..schemas import (
    CustomDocTypeRequest,
    CustomDocTypeResponse,
    CustomPipelineConfig,
    PipelineStepConfig,
    PipelineTemplateResponse,
)
from ..utils.tenant import get_tenant_id

router = APIRouter(prefix="/custom-pipelines", tags=["custom-pipelines"])


@router.get("/templates", response_model=list[PipelineTemplateResponse])
def get_pipeline_templates():
    """Get available pipeline templates."""
    templates = [
        PipelineTemplateResponse(
            name="Simple Extract & Send",
            description="Basic pipeline: Extract → Review → Send",
            steps=[
                PipelineStepConfig(
                    step_type="extraction",
                    name="Extract Data",
                    description="Extract structured data from document",
                    is_required=True,
                    config={"confidence_threshold": 0.7}
                ),
                PipelineStepConfig(
                    step_type="hil",
                    name="Human Review",
                    description="Manual review and correction",
                    is_required=True,
                    config={"auto_approve_threshold": 0.9}
                ),
                PipelineStepConfig(
                    step_type="send",
                    name="Send to Endpoint",
                    description="Send processed data to external system",
                    is_required=True,
                    config={}
                )
            ],
            use_cases=["Simple document processing", "Basic data entry"]
        ),
        PipelineTemplateResponse(
            name="Full Pipeline with Reconciliation",
            description="Complete pipeline: Extract → HIL → Fetch → Reconcile → Review → Send",
            steps=[
                PipelineStepConfig(
                    step_type="extraction",
                    name="Extract Data",
                    description="Extract structured data from document",
                    is_required=True,
                    config={"confidence_threshold": 0.7}
                ),
                PipelineStepConfig(
                    step_type="hil",
                    name="Initial Review",
                    description="Review extracted data",
                    is_required=True,
                    config={"auto_approve_threshold": 0.85}
                ),
                PipelineStepConfig(
                    step_type="fetch",
                    name="Fetch External Data",
                    description="Retrieve comparison data from external sources",
                    is_required=True,
                    config={"targets": ["accounting_api"]}
                ),
                PipelineStepConfig(
                    step_type="reconcile",
                    name="Reconcile Data",
                    description="Compare and reconcile extracted vs external data",
                    is_required=True,
                    config={"strategy": "LOOSE"}
                ),
                PipelineStepConfig(
                    step_type="hil",
                    name="Final Review",
                    description="Review reconciliation results",
                    is_required=True,
                    config={"focus_on_conflicts": True}
                ),
                PipelineStepConfig(
                    step_type="send",
                    name="Send to Endpoint",
                    description="Send final processed data",
                    is_required=True,
                    config={}
                )
            ],
            use_cases=["Invoice processing", "Financial document validation", "Compliance workflows"]
        ),
        PipelineTemplateResponse(
            name="Parent-Child Processing",
            description="Pipeline for documents with related objects: Extract parent → HIL → Send parent → Extract children → HIL children → Send children",
            steps=[
                PipelineStepConfig(
                    step_type="extraction",
                    name="Extract Parent Object",
                    description="Extract main document data",
                    is_required=True,
                    config={"object_filter": "parent"}
                ),
                PipelineStepConfig(
                    step_type="hil",
                    name="Review Parent",
                    description="Review parent object data",
                    is_required=True,
                    config={"object_filter": "parent"}
                ),
                PipelineStepConfig(
                    step_type="send",
                    name="Send Parent",
                    description="Send parent object to external system",
                    is_required=True,
                    config={"object_filter": "parent"}
                ),
                PipelineStepConfig(
                    step_type="extraction",
                    name="Extract Child Objects",
                    description="Extract related child data",
                    is_required=True,
                    config={"object_filter": "child"},
                    depends_on=["Send Parent"]
                ),
                PipelineStepConfig(
                    step_type="hil",
                    name="Review Children",
                    description="Review child objects",
                    is_required=True,
                    config={"object_filter": "child"}
                ),
                PipelineStepConfig(
                    step_type="send",
                    name="Send Children",
                    description="Send child objects to external system",
                    is_required=True,
                    config={"object_filter": "child"}
                )
            ],
            use_cases=["Invoice with line items", "Purchase orders", "Multi-part documents"]
        ),
        PipelineTemplateResponse(
            name="Parallel Multi-Object",
            description="Process multiple objects simultaneously: Extract all → HIL all → Send all",
            steps=[
                PipelineStepConfig(
                    step_type="extraction",
                    name="Extract All Objects",
                    description="Extract all document objects simultaneously",
                    is_required=True,
                    config={"parallel": True}
                ),
                PipelineStepConfig(
                    step_type="hil",
                    name="Review All Objects",
                    description="Review all objects in parallel",
                    is_required=True,
                    config={"parallel": True}
                ),
                PipelineStepConfig(
                    step_type="send",
                    name="Send All Objects",
                    description="Send all objects simultaneously",
                    is_required=True,
                    config={"parallel": True}
                )
            ],
            use_cases=["Independent data objects", "Batch processing", "Parallel workflows"]
        )
    ]
    
    return templates


@router.post("/doc-types", response_model=CustomDocTypeResponse)
async def create_custom_doc_type(
    request: CustomDocTypeRequest,
    tenant_id: int = Depends(get_tenant_id)
):
    """Create a new custom document type with pipeline configuration."""
    
    with get_session_sync() as session:
        # Create the document type with pipeline config stored as JSON
        doc_type = CustomDocTypeDefinition(
            tenant_id=tenant_id,
            name=request.name,
            description=request.description,
            instructions=request.instructions,
            output_schema=request.output_schema,
            destination_webhook=request.destination_webhook,
            pipeline_config=request.pipeline_config.model_dump()
        )
        
        session.add(doc_type)
        session.commit()
        
        return CustomDocTypeResponse(
            id=doc_type.id,
            tenant_id=doc_type.tenant_id,
            name=doc_type.name,
            description=doc_type.description,
            instructions=doc_type.instructions,
            output_schema=doc_type.output_schema,
            destination_webhook=doc_type.destination_webhook,
            pipeline_config=doc_type.pipeline_config,
            created_at=doc_type.created_at,
            updated_at=doc_type.updated_at
        )

# Non-trailing-slash variants to avoid 307 redirects
@router.post("/doc-types/")
async def create_custom_doc_type_slash(
    request: CustomDocTypeRequest,
    tenant_id: int = Depends(get_tenant_id)
):
    return await create_custom_doc_type(request, tenant_id)


@router.get("/doc-types", response_model=list[CustomDocTypeResponse])
async def get_custom_doc_types(tenant_id: int = Depends(get_tenant_id)):
    """Get all custom document types for the tenant."""
    
    with get_session_sync() as session:
        stmt = select(CustomDocTypeDefinition).where(
            CustomDocTypeDefinition.tenant_id == tenant_id
        )
        doc_types = session.exec(stmt).all()
        
        return [
            CustomDocTypeResponse(
                id=doc_type.id,
                tenant_id=doc_type.tenant_id,
                name=doc_type.name,
                description=doc_type.description,
                instructions=doc_type.instructions,
                output_schema=doc_type.output_schema,
                destination_webhook=doc_type.destination_webhook,
                pipeline_config=doc_type.pipeline_config,
                created_at=doc_type.created_at,
                updated_at=doc_type.updated_at
            )
            for doc_type in doc_types
        ]

@router.get("/doc-types/")
async def get_custom_doc_types_slash(tenant_id: int = Depends(get_tenant_id)):
    return await get_custom_doc_types(tenant_id)


@router.get("/doc-types/{doc_type_id}", response_model=CustomDocTypeResponse)
async def get_custom_doc_type(
    doc_type_id: int,
    tenant_id: int = Depends(get_tenant_id)
):
    """Get a specific custom document type."""
    
    with get_session_sync() as session:
        stmt = select(CustomDocTypeDefinition).where(
            CustomDocTypeDefinition.id == doc_type_id,
            CustomDocTypeDefinition.tenant_id == tenant_id
        )
        doc_type = session.exec(stmt).first()
        
        if not doc_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document type not found"
            )
        
        return CustomDocTypeResponse(
            id=doc_type.id,
            tenant_id=doc_type.tenant_id,
            name=doc_type.name,
            description=doc_type.description,
            instructions=doc_type.instructions,
            output_schema=doc_type.output_schema,
            destination_webhook=doc_type.destination_webhook,
            pipeline_config=doc_type.pipeline_config,
            created_at=doc_type.created_at,
            updated_at=doc_type.updated_at
        )

@router.get("/doc-types/{doc_type_id}/")
async def get_custom_doc_type_slash(
    doc_type_id: int,
    tenant_id: int = Depends(get_tenant_id)
):
    return await get_custom_doc_type(doc_type_id, tenant_id)


@router.put("/doc-types/{doc_type_id}", response_model=CustomDocTypeResponse)
async def update_custom_doc_type(
    doc_type_id: int,
    request: CustomDocTypeRequest,
    tenant_id: int = Depends(get_tenant_id)
):
    """Update a custom document type and its pipeline."""
    
    with get_session_sync() as session:
        stmt = select(CustomDocTypeDefinition).where(
            CustomDocTypeDefinition.id == doc_type_id,
            CustomDocTypeDefinition.tenant_id == tenant_id
        )
        doc_type = session.exec(stmt).first()
        
        if not doc_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document type not found"
            )
        
        # Update document type
        doc_type.name = request.name
        doc_type.description = request.description
        doc_type.instructions = request.instructions
        doc_type.output_schema = request.output_schema
        doc_type.destination_webhook = request.destination_webhook
        doc_type.pipeline_config = request.pipeline_config.model_dump()
        
        session.commit()
        
        return CustomDocTypeResponse(
            id=doc_type.id,
            tenant_id=doc_type.tenant_id,
            name=doc_type.name,
            description=doc_type.description,
            instructions=doc_type.instructions,
            output_schema=doc_type.output_schema,
            destination_webhook=doc_type.destination_webhook,
            pipeline_config=doc_type.pipeline_config,
            created_at=doc_type.created_at,
            updated_at=doc_type.updated_at
        )

@router.put("/doc-types/{doc_type_id}/")
async def update_custom_doc_type_slash(
    doc_type_id: int,
    request: CustomDocTypeRequest,
    tenant_id: int = Depends(get_tenant_id)
):
    return await update_custom_doc_type(doc_type_id, request, tenant_id)


@router.delete("/doc-types/{doc_type_id}")
async def delete_custom_doc_type(
    doc_type_id: int,
    tenant_id: int = Depends(get_tenant_id)
):
    """Delete a custom document type and its pipeline."""
    
    with get_session_sync() as session:
        stmt = select(CustomDocTypeDefinition).where(
            CustomDocTypeDefinition.id == doc_type_id,
            CustomDocTypeDefinition.tenant_id == tenant_id
        )
        doc_type = session.exec(stmt).first()
        
        if not doc_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document type not found"
            )
        
        # Delete the document type (pipeline config is stored as JSON)
        session.delete(doc_type)
        session.commit()
        
        return {"message": "Document type deleted successfully"}

@router.delete("/doc-types/{doc_type_id}/")
async def delete_custom_doc_type_slash(
    doc_type_id: int,
    tenant_id: int = Depends(get_tenant_id)
):
    return await delete_custom_doc_type(doc_type_id, tenant_id)


@router.get("/doc-types/{doc_type_id}/pipeline", response_model=dict[str, Any])
async def get_pipeline_config(
    doc_type_id: int,
    tenant_id: int = Depends(get_tenant_id)
):
    """Get detailed pipeline configuration for a document type."""
    
    with get_session_sync() as session:
        # Get document type
        doc_type_stmt = select(CustomDocTypeDefinition).where(
            CustomDocTypeDefinition.id == doc_type_id,
            CustomDocTypeDefinition.tenant_id == tenant_id
        )
        doc_type = session.exec(doc_type_stmt).first()
        
        if not doc_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document type not found"
            )
        
        # Pipeline config is stored as JSON in the document type
        pipeline_config = doc_type.pipeline_config or {}
        
        return {
            "doc_type": {
                "id": doc_type.id,
                "name": doc_type.name,
                "description": doc_type.description
            },
            "pipeline": {
                "name": pipeline_config.get("name", "Default Pipeline"),
                "description": pipeline_config.get("description"),
                "steps": pipeline_config.get("steps", []),
                "parallel_processing": pipeline_config.get("parallel_processing", False)
            },
            "objects": pipeline_config.get("objects", [])
        }


# Pipeline execution functionality would go here if needed for actual pipeline runs
