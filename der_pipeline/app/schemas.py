"""Pydantic DTOs for API requests and responses."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, RootModel

from .enums import Decision, DocumentType, PipelineState, ReconcileStatus, ReconcileStrategy


# Base field types
class ExtractedField(BaseModel):
    """Individual extracted field with metadata."""

    value: Any
    confidence: float | None = None
    type_hint: str | None = None


class CorrectedField(ExtractedField):
    """Corrected field with correction reason."""

    correction_reason: str | None = None


class FetchedRecord(BaseModel):
    """Record fetched from external source."""

    source: str
    payload: dict[str, Any]


class ReconcileDiff(BaseModel):
    """Individual field reconciliation result."""

    field: str
    extracted_value: Any | None = None
    fetched_value: Any | None = None
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
    content: str | None = Field(None, description="Base64 encoded content")
    url: str | None = Field(None, description="URL to fetch content from")


class IngestResponse(BaseModel):
    """Response from document ingestion."""

    document_id: int
    state: PipelineState
    extracted: dict[str, ExtractedField]


class HilResponse(BaseModel):
    """Response for HIL operations."""

    document_id: int
    current_state: PipelineState
    extracted: dict[str, ExtractedField] | None = None
    extracted_full: dict[str, ExtractedField] | None = None
    corrected: dict[str, CorrectedField] | None = None
    confidence_threshold: float = 0.8


class HilUpdateRequest(BaseModel):
    """Request to update HIL corrections."""

    corrections: dict[str, CorrectedField]
    reviewer: str
    notes: str | None = None


class HilUpdateResponse(BaseModel):
    """Response from HIL update."""

    document_id: int
    state: PipelineState
    corrections_applied: int


class FetchRequest(BaseModel):
    """Request to fetch comparator data."""

    targets: list[str] | None = Field(None, description="External sources to query")


class FetchResponse(BaseModel):
    """Response from fetch operation."""

    document_id: int
    state: PipelineState
    fetch_job_id: int
    targets_processed: list[str]


class ReconcileRequest(BaseModel):
    """Request to reconcile extracted vs fetched data."""

    strategy: ReconcileStrategy = ReconcileStrategy.LOOSE
    thresholds: dict[str, float] | None = Field(
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
    notes: str | None = None


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
    latest_extraction: dict[str, ExtractedField] | None = None
    latest_correction: dict[str, CorrectedField] | None = None
    latest_fetch: dict[str, FetchedRecord] | None = None
    latest_reconciliation: ReconcileResponse | None = None
    final_decision: FinalizeResponse | None = None
    audit_trail: list[dict[str, Any]]


# Document Type Specific Schemas
class InvoiceData(BaseModel):
    """Invoice specific data schema."""

    invoice_number: str
    vendor_name: str
    vendor_address: str | None = None
    vendor_tax_id: str | None = None
    invoice_date: str
    due_date: str | None = None
    subtotal: float
    tax_amount: float | None = None
    total_amount: float
    currency: str = "USD"
    line_items: list[dict[str, Any]] = Field(default_factory=list)
    payment_terms: str | None = None


class ReceiptData(BaseModel):
    """Receipt specific data schema."""

    merchant_name: str
    merchant_address: str | None = None
    transaction_date: str
    transaction_time: str | None = None
    total_amount: float
    tax_amount: float | None = None
    currency: str = "USD"
    payment_method: str | None = None
    items: list[dict[str, Any]] = Field(default_factory=list)
    receipt_number: str | None = None


class EntryExitLogData(BaseModel):
    """Entry/Exit log specific data schema."""

    person_name: str
    person_id: str | None = None
    entry_time: str | None = None
    exit_time: str | None = None
    location: str
    purpose: str | None = None
    authorized_by: str | None = None
    badge_number: str | None = None
    vehicle_info: str | None = None


# RAG System Schemas
class RagDocumentCreate(BaseModel):
    """Request to create a RAG document."""

    document_type: DocumentType
    reference_data: dict[str, Any]
    description: str | None = None
    tags: list[str] = Field(default_factory=list)


class RagDocumentResponse(BaseModel):
    """Response for RAG document operations."""

    id: int
    document_type: DocumentType
    reference_data: dict[str, Any]
    description: str | None = None
    tags: list[str]
    created_at: datetime
    updated_at: datetime


class RagSearchRequest(BaseModel):
    """Request to search RAG documents."""

    query: str
    document_type: DocumentType | None = None
    limit: int = Field(default=10, le=50)
    similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0)


class RagSearchResult(BaseModel):
    """RAG search result."""

    id: int
    reference_data: dict[str, Any]
    description: str | None = None
    similarity_score: float
    tags: list[str]


# Debug System Schemas
class DebugRequest(BaseModel):
    """Request for AI debugging analysis."""

    stage: str
    debug_type: str
    input_data: dict[str, Any]
    context: dict[str, Any] | None = None


class DebugResponse(BaseModel):
    """Response from AI debugging analysis."""

    session_id: int
    stage: str
    debug_type: str
    ai_analysis: dict[str, Any]
    recommendations: list[str]
    confidence_score: float | None = None


class DebugRunRequest(BaseModel):
    """Request to perform a dry-run extraction for debugging."""

    document_type_override: str | None = None
    use_vision: bool = True
    sample_text: str | None = None


class DebugRunResponse(BaseModel):
    """Response from a dry-run extraction."""

    used_document_type: str
    fields: dict[str, ExtractedField]
    prompt_chars: int | None = None
    content_chars: int | None = None
    notes: str | None = None


# Enhanced Document Reports
class DocumentListItem(BaseModel):
    """Document list item with type information."""

    id: int
    filename: str
    document_type: DocumentType
    state: PipelineState
    uploaded_at: datetime
    confidence_score: float | None = None


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
