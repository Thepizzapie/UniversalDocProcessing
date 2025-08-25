"""Document type management API routes."""

from typing import List, Any, Dict
from fastapi import APIRouter, HTTPException, status
from sqlmodel import Session, select

from ..db import get_session
from ..models import Document, DocumentTypeTemplate
from ..schemas import DocumentListItem
from ..enums import DocumentType, PipelineState

router = APIRouter(prefix="/api/document-types", tags=["document-types"])


@router.get("/templates", response_model=List[Dict[str, Any]])
async def get_document_type_templates():
    """Get all document type templates."""
    templates = {
        DocumentType.INVOICE: {
            "document_type": DocumentType.INVOICE,
            "template_name": "Standard Invoice",
            "required_fields": [
                "invoice_number", "vendor_name", "invoice_date", 
                "total_amount", "currency"
            ],
            "optional_fields": [
                "vendor_address", "vendor_tax_id", "due_date", 
                "subtotal", "tax_amount", "line_items", "payment_terms"
            ],
            "field_schemas": {
                "invoice_number": {"type": "string", "pattern": "^[A-Z0-9-]+$"},
                "vendor_name": {"type": "string", "minLength": 2},
                "invoice_date": {"type": "string", "format": "date"},
                "total_amount": {"type": "number", "minimum": 0},
                "currency": {"type": "string", "enum": ["USD", "EUR", "GBP"]}
            },
            "validation_rules": {
                "total_amount_check": "total_amount > 0",
                "date_format": "invoice_date matches YYYY-MM-DD",
                "vendor_required": "vendor_name is not empty"
            }
        },
        DocumentType.RECEIPT: {
            "document_type": DocumentType.RECEIPT,
            "template_name": "Standard Receipt",
            "required_fields": [
                "merchant_name", "transaction_date", "total_amount", "currency"
            ],
            "optional_fields": [
                "merchant_address", "transaction_time", "tax_amount", 
                "payment_method", "items", "receipt_number"
            ],
            "field_schemas": {
                "merchant_name": {"type": "string", "minLength": 2},
                "transaction_date": {"type": "string", "format": "date"},
                "total_amount": {"type": "number", "minimum": 0},
                "currency": {"type": "string", "enum": ["USD", "EUR", "GBP"]},
                "payment_method": {"type": "string", "enum": ["cash", "credit", "debit", "mobile"]}
            },
            "validation_rules": {
                "amount_positive": "total_amount > 0",
                "merchant_required": "merchant_name is not empty"
            }
        },
        DocumentType.ENTRY_EXIT_LOG: {
            "document_type": DocumentType.ENTRY_EXIT_LOG,
            "template_name": "Standard Entry/Exit Log",
            "required_fields": [
                "person_name", "location"
            ],
            "optional_fields": [
                "person_id", "entry_time", "exit_time", "purpose", 
                "authorized_by", "badge_number", "vehicle_info"
            ],
            "field_schemas": {
                "person_name": {"type": "string", "minLength": 2},
                "location": {"type": "string", "minLength": 2},
                "entry_time": {"type": "string", "format": "time"},
                "exit_time": {"type": "string", "format": "time"},
                "badge_number": {"type": "string", "pattern": "^[A-Z0-9]+$"}
            },
            "validation_rules": {
                "person_required": "person_name is not empty",
                "location_required": "location is not empty"
            }
        }
    }
    
    return list(templates.values())


@router.get("/{document_type}/template", response_model=Dict[str, Any])
async def get_document_type_template(document_type: DocumentType):
    """Get template for a specific document type."""
    templates = await get_document_type_templates()
    
    for template in templates:
        if template["document_type"] == document_type:
            return template
    
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Template not found for document type: {document_type}"
    )


@router.get("/{document_type}/documents", response_model=List[DocumentListItem])
async def get_documents_by_type(document_type: DocumentType):
    """Get all documents of a specific type."""
    try:
        with Session(get_session().bind) as session:
            stmt = select(Document).where(Document.document_type == document_type)
            documents = session.exec(stmt).all()
            
            return [
                DocumentListItem(
                    id=doc.id,
                    filename=doc.filename,
                    document_type=doc.document_type,
                    state=doc.state,
                    uploaded_at=doc.uploaded_at,
                    confidence_score=None  # Would need to calculate from extractions
                )
                for doc in documents
            ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get documents: {str(e)}"
        )


@router.put("/{document_id}/type", response_model=Dict[str, Any])
async def update_document_type(document_id: int, new_type: DocumentType):
    """Update the document type for a document."""
    try:
        with Session(get_session().bind) as session:
            stmt = select(Document).where(Document.id == document_id)
            document = session.exec(stmt).first()
            
            if not document:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Document not found"
                )
            
            old_type = document.document_type
            document.document_type = new_type
            
            session.add(document)
            session.commit()
            
            return {
                "document_id": document_id,
                "old_type": old_type,
                "new_type": new_type,
                "message": "Document type updated successfully"
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update document type: {str(e)}"
        )


@router.get("/stats", response_model=Dict[str, Any])
async def get_document_type_stats():
    """Get statistics for each document type."""
    try:
        with Session(get_session().bind) as session:
            stats = {}
            
            for doc_type in DocumentType:
                # Count total documents
                total_stmt = select(Document).where(Document.document_type == doc_type)
                total_count = len(session.exec(total_stmt).all())
                
                # Count by state
                state_counts = {}
                for state in PipelineState:
                    state_stmt = select(Document).where(
                        Document.document_type == doc_type,
                        Document.state == state
                    )
                    state_counts[state.value] = len(session.exec(state_stmt).all())
                
                stats[doc_type.value] = {
                    "total_documents": total_count,
                    "state_breakdown": state_counts
                }
            
            return stats
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get statistics: {str(e)}"
        )
