"""RAG (Retrieval Augmented Generation) API routes."""

from fastapi import APIRouter, HTTPException, status

from ..enums import DocumentType
from ..schemas import RagDocumentCreate, RagDocumentResponse, RagSearchRequest, RagSearchResult
from ..services.rag_service import rag_service

router = APIRouter(prefix="/api/rag", tags=["rag"])


@router.post("/documents", response_model=RagDocumentResponse)
async def create_rag_document(request: RagDocumentCreate):
    """Create a new RAG reference document."""
    try:
        return rag_service.add_rag_document(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create RAG document: {str(e)}",
        )


@router.get("/documents/{document_type}", response_model=list[RagDocumentResponse])
async def get_rag_documents_by_type(document_type: DocumentType):
    """Get all RAG documents of a specific type."""
    try:
        return rag_service.get_rag_documents_by_type(document_type)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve RAG documents: {str(e)}",
        )


@router.post("/search", response_model=list[RagSearchResult])
async def search_rag_documents(request: RagSearchRequest):
    """Search RAG documents using semantic similarity."""
    try:
        return rag_service.search_rag_documents(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search RAG documents: {str(e)}",
        )


@router.delete("/documents/{doc_id}")
async def delete_rag_document(doc_id: int):
    """Delete a RAG document."""
    try:
        success = rag_service.delete_rag_document(doc_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="RAG document not found"
            )
        return {"message": "RAG document deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete RAG document: {str(e)}",
        )


@router.post("/seed-sample-data")
async def seed_sample_data():
    """Seed the RAG database with sample reference data."""
    try:
        rag_service.seed_sample_data()
        return {"message": "Sample RAG data seeded successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to seed sample data: {str(e)}",
        )
