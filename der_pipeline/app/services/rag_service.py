"""RAG (Retrieval Augmented Generation) service for reconciliation reference data."""

import json
import numpy as np
from datetime import datetime
from typing import Any, List, Optional
from sqlmodel import Session, select
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from ..db import get_session
from ..models import RagDocument
from ..schemas import (
    RagDocumentCreate, 
    RagDocumentResponse, 
    RagSearchRequest, 
    RagSearchResult
)
from ..enums import DocumentType
from ..config import settings


class RagService:
    """Service for managing RAG documents and semantic search."""
    
    def __init__(self):
        """Initialize the RAG service with embedding model."""
        try:
            # Use a lightweight sentence transformer model
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            self.model_initialized = True
        except Exception as e:
            print(f"Warning: Could not initialize embedding model: {e}")
            self.model = None
            self.model_initialized = False
    
    def _generate_embedding(self, text: str) -> Optional[str]:
        """Generate embedding vector for text."""
        if not self.model_initialized:
            return None
        
        try:
            # Convert input to string if it's a dict
            if isinstance(text, dict):
                text = json.dumps(text, sort_keys=True)
            
            embedding = self.model.encode([text])[0]
            return json.dumps(embedding.tolist())
        except Exception as e:
            print(f"Error generating embedding: {e}")
            return None
    
    def add_rag_document(self, request: RagDocumentCreate) -> RagDocumentResponse:
        """Add a new RAG document with embedding."""
        # Generate embedding for the reference data
        reference_text = json.dumps(request.reference_data, sort_keys=True)
        embedding = self._generate_embedding(reference_text)
        
        with Session(get_session().bind) as session:
            rag_doc = RagDocument(
                document_type=request.document_type,
                reference_data=request.reference_data,
                description=request.description,
                tags=request.tags,
                embedding_vector=embedding,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            session.add(rag_doc)
            session.commit()
            session.refresh(rag_doc)
            
            return RagDocumentResponse(
                id=rag_doc.id,
                document_type=rag_doc.document_type,
                reference_data=rag_doc.reference_data,
                description=rag_doc.description,
                tags=rag_doc.tags,
                created_at=rag_doc.created_at,
                updated_at=rag_doc.updated_at
            )
    
    def search_rag_documents(self, request: RagSearchRequest) -> List[RagSearchResult]:
        """Search RAG documents using semantic similarity."""
        if not self.model_initialized:
            return self._fallback_search(request)
        
        # Generate query embedding
        query_embedding = self._generate_embedding(request.query)
        if not query_embedding:
            return self._fallback_search(request)
        
        query_vector = np.array(json.loads(query_embedding)).reshape(1, -1)
        
        with Session(get_session().bind) as session:
            # Build query
            stmt = select(RagDocument)
            if request.document_type:
                stmt = stmt.where(RagDocument.document_type == request.document_type)
            
            rag_docs = session.exec(stmt).all()
            
            results = []
            for doc in rag_docs:
                if doc.embedding_vector:
                    try:
                        doc_vector = np.array(json.loads(doc.embedding_vector)).reshape(1, -1)
                        similarity = cosine_similarity(query_vector, doc_vector)[0][0]
                        
                        if similarity >= request.similarity_threshold:
                            results.append(RagSearchResult(
                                id=doc.id,
                                reference_data=doc.reference_data,
                                description=doc.description,
                                similarity_score=float(similarity),
                                tags=doc.tags
                            ))
                    except Exception as e:
                        print(f"Error calculating similarity for doc {doc.id}: {e}")
                        continue
            
            # Sort by similarity score (descending) and limit results
            results.sort(key=lambda x: x.similarity_score, reverse=True)
            return results[:request.limit]
    
    def _fallback_search(self, request: RagSearchRequest) -> List[RagSearchResult]:
        """Fallback search using text matching when embeddings are not available."""
        with Session(get_session().bind) as session:
            stmt = select(RagDocument)
            if request.document_type:
                stmt = stmt.where(RagDocument.document_type == request.document_type)
            
            rag_docs = session.exec(stmt).all()
            
            results = []
            query_lower = request.query.lower()
            
            for doc in rag_docs:
                # Simple text matching score
                score = 0.0
                reference_text = json.dumps(doc.reference_data).lower()
                
                if query_lower in reference_text:
                    score = 0.8
                elif any(word in reference_text for word in query_lower.split()):
                    score = 0.5
                
                if doc.description and query_lower in doc.description.lower():
                    score = max(score, 0.7)
                
                if any(query_lower in tag.lower() for tag in doc.tags):
                    score = max(score, 0.6)
                
                if score >= request.similarity_threshold:
                    results.append(RagSearchResult(
                        id=doc.id,
                        reference_data=doc.reference_data,
                        description=doc.description,
                        similarity_score=score,
                        tags=doc.tags
                    ))
            
            # Sort by score and limit
            results.sort(key=lambda x: x.similarity_score, reverse=True)
            return results[:request.limit]
    
    def get_rag_documents_by_type(self, document_type: DocumentType) -> List[RagDocumentResponse]:
        """Get all RAG documents of a specific type."""
        with Session(get_session().bind) as session:
            stmt = select(RagDocument).where(RagDocument.document_type == document_type)
            rag_docs = session.exec(stmt).all()
            
            return [
                RagDocumentResponse(
                    id=doc.id,
                    document_type=doc.document_type,
                    reference_data=doc.reference_data,
                    description=doc.description,
                    tags=doc.tags,
                    created_at=doc.created_at,
                    updated_at=doc.updated_at
                )
                for doc in rag_docs
            ]
    
    def delete_rag_document(self, doc_id: int) -> bool:
        """Delete a RAG document."""
        with Session(get_session().bind) as session:
            stmt = select(RagDocument).where(RagDocument.id == doc_id)
            doc = session.exec(stmt).first()
            
            if doc:
                session.delete(doc)
                session.commit()
                return True
            return False
    
    def seed_sample_data(self):
        """Seed the RAG database with sample reference data."""
        sample_data = [
            # Invoice samples
            RagDocumentCreate(
                document_type=DocumentType.INVOICE,
                reference_data={
                    "vendor_name": "ACME Corp",
                    "vendor_address": "123 Business St, City, State 12345",
                    "vendor_tax_id": "12-3456789",
                    "typical_payment_terms": "Net 30",
                    "currency": "USD",
                    "contact_email": "billing@acme.com"
                },
                description="ACME Corp vendor master data",
                tags=["vendor", "frequent", "approved"]
            ),
            RagDocumentCreate(
                document_type=DocumentType.INVOICE,
                reference_data={
                    "vendor_name": "Office Supplies Inc",
                    "vendor_address": "456 Supply Ave, Business City, State 54321",
                    "vendor_tax_id": "98-7654321",
                    "typical_payment_terms": "Net 15",
                    "currency": "USD",
                    "contact_email": "invoices@officesupplies.com"
                },
                description="Office Supplies Inc vendor data",
                tags=["vendor", "supplies", "approved"]
            ),
            
            # Receipt samples
            RagDocumentCreate(
                document_type=DocumentType.RECEIPT,
                reference_data={
                    "merchant_name": "Coffee Shop Downtown",
                    "merchant_address": "789 Main St, Downtown, State 11111",
                    "typical_items": ["coffee", "pastries", "sandwiches"],
                    "typical_amount_range": [5.00, 25.00],
                    "currency": "USD"
                },
                description="Coffee Shop Downtown reference",
                tags=["merchant", "food", "frequent"]
            ),
            
            # Entry/Exit Log samples
            RagDocumentCreate(
                document_type=DocumentType.ENTRY_EXIT_LOG,
                reference_data={
                    "location": "Building A - Main Entrance",
                    "authorized_personnel": ["John Doe", "Jane Smith", "Mike Johnson"],
                    "standard_hours": "8:00 AM - 6:00 PM",
                    "security_level": "Standard Access",
                    "badge_prefix": "EMP"
                },
                description="Building A access control data",
                tags=["access", "building-a", "standard"]
            )
        ]
        
        for data in sample_data:
            try:
                self.add_rag_document(data)
                print(f"Added sample RAG document: {data.description}")
            except Exception as e:
                print(f"Error adding sample data: {e}")


# Global instance
rag_service = RagService()
