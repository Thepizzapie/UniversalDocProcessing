"""Pydantic DTOs for API requests and responses."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, RootModel

from .enums import Decision, DocumentType, PipelineState, ReconcileStatus, ReconcileStrategy


# Base field types
class ExtractedField(BaseModel):
    """Individual extracted field with metadata."""

    value: Any
    confidence: Optional[float] = None
    type_hint: Optional[str] = None


class CorrectedField(ExtractedField):
    """Corrected field with correction reason."""

    correction_reason: Optional[str] = None


class FetchedRecord(BaseModel):
    """Record fetched from external source."""

    source: str
    payload: dict[str, Any]


class ReconcileDiff(BaseModel):
    """Individual field reconciliation result."""

    field: str
    extracted_value: Optional[Any] = None
    fetched_value: Optional[Any] = None
    match_score: float
    status: ReconcileStatus


# Request/Response DTOs
class ExtractedRecord(RootModel[dict[str, ExtractedField]]):
    """Complete extracted record as a dictionary of fields."""


class CorrectedRecord(RootModel[dict[str, CorrectedField]]):
    """Complete corrected record as a dictionary of fields."""


class IngestRequest(BaseModel):
    """Request to ingest a new document."""

    filename: str
    mime_type: str
    document_type: DocumentType = DocumentType.UNKNOWN
    custom_doc_type_name: Optional[str] = Field(None, description="Exact name of a custom doc type to force-use for extraction")
    content: Optional[str] = Field(None, description="Base64 encoded content")
    url: Optional[str] = Field(None, description="URL to fetch content from")


class IngestResponse(BaseModel):
    """Response from document ingestion."""

    document_id: int
    state: PipelineState
    extracted: dict[str, ExtractedField]


class HilResponse(BaseModel):
    """Response for HIL operations."""

    document_id: int
    current_state: PipelineState
    extracted: Optional[dict[str, ExtractedField]] = None
    extracted_full: Optional[dict[str, ExtractedField]] = None
    corrected: Optional[dict[str, CorrectedField]] = None
    confidence_threshold: float = 0.8


class HilUpdateRequest(BaseModel):
    """Request to update HIL corrections."""

    corrections: dict[str, CorrectedField]
    reviewer: str
    notes: Optional[str] = None


class HilUpdateResponse(BaseModel):
    """Response from HIL update."""

    document_id: int
    state: PipelineState
    corrections_applied: int


class FetchRequest(BaseModel):
    """Request to fetch comparator data."""

    targets: Optional[list[str]] = Field(None, description="External sources to query")


class FetchResponse(BaseModel):
    """Response from fetch operation."""

    document_id: int
    state: PipelineState
    fetch_job_id: int
    targets_processed: list[str]


class ReconcileRequest(BaseModel):
    """Request to reconcile extracted vs fetched data."""

    strategy: ReconcileStrategy = ReconcileStrategy.LOOSE
    thresholds: Optional[dict[str, float]] = Field(
        default_factory=lambda: {"exact": 1.0, "fuzzy": 0.85}
    )


class ReconcileResponse(BaseModel):
    """Response from reconciliation."""

    document_id: int
    state: PipelineState
    result: list[ReconcileDiff]
    score_overall: float
    strategy_used: ReconcileStrategy


class FinalizeRequest(BaseModel):
    """Request to finalize document processing."""

    decision: Decision
    decider: str
    notes: Optional[str] = None


class FinalizeResponse(BaseModel):
    """Response from finalization."""

    document_id: int
    state: PipelineState
    decision: Decision
    finalized_at: datetime


class DocumentReport(BaseModel):
    """Complete document processing report."""

    document_id: int
    filename: str
    state: PipelineState
    uploaded_at: datetime
    latest_extraction: Optional[dict[str, ExtractedField]] = None
    latest_correction: Optional[dict[str, CorrectedField]] = None
    latest_fetch: Optional[dict[str, FetchedRecord]] = None
    latest_reconciliation: Optional[ReconcileResponse] = None
    final_decision: Optional[FinalizeResponse] = None
    audit_trail: list[dict[str, Any]]
    # Optional: Authoritative pipeline details to avoid client-side guessing
    pipeline_step_types: Optional[list[str]] = None
    pipeline_custom_doc_type_name: Optional[str] = None


# Document Type Specific Schemas
class InvoiceData(BaseModel):
    """Invoice specific data schema."""

    invoice_number: str
    vendor_name: str
    vendor_address: Optional[str] = None
    vendor_tax_id: Optional[str] = None
    invoice_date: str
    due_date: Optional[str] = None
    subtotal: float
    tax_amount: Optional[float] = None
    total_amount: float
    currency: str = "USD"
    line_items: list[dict[str, Any]] = Field(default_factory=list)
    payment_terms: Optional[str] = None


class ReceiptData(BaseModel):
    """Receipt specific data schema."""

    merchant_name: str
    merchant_address: Optional[str] = None
    transaction_date: str
    transaction_time: Optional[str] = None
    total_amount: float
    tax_amount: Optional[float] = None
    currency: str = "USD"
    payment_method: Optional[str] = None
    items: list[dict[str, Any]] = Field(default_factory=list)
    receipt_number: Optional[str] = None


class EntryExitLogData(BaseModel):
    """Entry/Exit log specific data schema."""

    person_name: str
    person_id: Optional[str] = None
    entry_time: Optional[str] = None
    exit_time: Optional[str] = None
    location: str
    purpose: Optional[str] = None
    authorized_by: Optional[str] = None
    badge_number: Optional[str] = None
    vehicle_info: Optional[str] = None


# RAG System Schemas
class RagDocumentCreate(BaseModel):
    """Request to create a RAG document."""

    document_type: DocumentType
    reference_data: dict[str, Any]
    description: Optional[str] = None
    tags: list[str] = Field(default_factory=list)


class RagDocumentResponse(BaseModel):
    """Response for RAG document operations."""

    id: int
    document_type: DocumentType
    reference_data: dict[str, Any]
    description: Optional[str] = None
    tags: list[str]
    created_at: datetime
    updated_at: datetime


class RagSearchRequest(BaseModel):
    """Request to search RAG documents."""

    query: str
    document_type: Optional[DocumentType] = None
    limit: int = Field(default=10, le=50)
    similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0)


class RagSearchResult(BaseModel):
    """RAG search result."""

    id: int
    reference_data: dict[str, Any]
    description: Optional[str] = None
    similarity_score: float
    tags: list[str]


# Debug System Schemas
class DebugRequest(BaseModel):
    """Request for AI debugging analysis."""

    stage: str
    debug_type: str
    input_data: dict[str, Any]
    context: Optional[dict[str, Any]] = None


class DebugResponse(BaseModel):
    """Response from AI debugging analysis."""

    session_id: int
    stage: str
    debug_type: str
    ai_analysis: dict[str, Any]
    recommendations: list[str]
    confidence_score: Optional[float] = None


class DebugRunRequest(BaseModel):
    """Request to perform a dry-run extraction for debugging."""

    document_type_override: Optional[str] = None
    use_vision: bool = True
    sample_text: Optional[str] = None


class DebugRunResponse(BaseModel):
    """Response from a dry-run extraction."""

    used_document_type: str
    fields: dict[str, ExtractedField]
    prompt_chars: Optional[int] = None
    content_chars: Optional[int] = None
    notes: Optional[str] = None


# Enhanced Document Reports
class DocumentListItem(BaseModel):
    """Document list item with type information."""

    id: int
    filename: str
    document_type: DocumentType
    state: PipelineState
    uploaded_at: datetime
    confidence_score: Optional[float] = None


# Authentication Schemas
class LoginRequest(BaseModel):
    """User login request."""

    email: str
    password: str


class RegisterRequest(BaseModel):
    """User registration request."""

    email: str
    password: str
    role: str = "user"


class TokenResponse(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: int
    email: str
    role: str


class UserResponse(BaseModel):
    """User profile response."""

    id: int
    email: str
    role: str
    is_active: bool
    created_at: datetime


# Configuration Schema
class ConfigResponse(BaseModel):
    """Safe configuration information."""

    app_env: str
    llm_model: str
    ocr_enabled: bool
    crewai_enabled: bool
    rate_limit_per_minute: int
    cors_allow_origins: list[str]


# Pipeline Configuration Schemas
class PipelineStepConfig(BaseModel):
    """Configuration for a single pipeline step."""
    
    step_type: str  # 'extraction', 'hil', 'fetch', 'reconcile', 'send'
    name: str
    description: Optional[str] = None
    is_required: bool = True
    config: dict[str, Any] = Field(default_factory=dict)
    depends_on: list[str] = Field(default_factory=list)  # Step dependencies


class ExtractionObjectConfig(BaseModel):
    """Configuration for an extraction object."""
    
    name: str
    object_type: str  # 'parent', 'child', 'standalone'
    parent_object_name: Optional[str] = None
    object_schema: dict[str, Any]
    extraction_instructions: Optional[str] = None
    hil_config: dict[str, Any] = Field(default_factory=dict)
    send_config: dict[str, Any] = Field(default_factory=dict)


class CustomPipelineConfig(BaseModel):
    """Complete pipeline configuration for a document type."""
    
    name: str
    description: Optional[str] = None
    steps: list[PipelineStepConfig]
    objects: list[ExtractionObjectConfig]
    parallel_processing: bool = False
    global_config: dict[str, Any] = Field(default_factory=dict)


class CustomDocTypeRequest(BaseModel):
    """Request to create/update a custom document type with pipeline."""
    
    name: str
    description: Optional[str] = None
    instructions: dict[str, Any]
    output_schema: dict[str, Any]
    destination_webhook: Optional[str] = None
    pipeline_config: CustomPipelineConfig


class CustomDocTypeResponse(BaseModel):
    """Response for custom document type."""
    
    id: int
    tenant_id: int
    name: str
    description: Optional[str]
    instructions: dict[str, Any]
    output_schema: dict[str, Any]
    destination_webhook: Optional[str]
    pipeline_config: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class PipelineTemplateResponse(BaseModel):
    """Available pipeline templates."""

    name: str
    description: str
    steps: list[PipelineStepConfig]
    use_cases: list[str]


class HilReviewRequest(BaseModel):
    """Request to submit HIL review decisions."""

    document_id: int = Field(..., description="Document being reviewed")
    decision: Decision = Field(..., description="Overall decision: approve or reject")
    field_reviews: list[dict[str, Any]] = Field(default_factory=list, description="Individual field review decisions")
    overall_comments: Optional[str] = Field(None, description="Overall review comments")
    reviewed_at: Optional[datetime] = Field(default_factory=datetime.utcnow, description="When review was completed")


class HilReviewResponse(BaseModel):
    """Response from HIL review submission."""

    document_id: int
    decision: Decision
    state: PipelineState
    reviewed_at: datetime
    field_reviews_processed: int
