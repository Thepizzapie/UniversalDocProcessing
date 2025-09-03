"""SQLModel entities for the document processing pipeline."""

from datetime import datetime
from typing import Any

from sqlalchemy import Column
from sqlmodel import JSON, Field, Relationship, SQLModel

from .enums import ActorType, Decision, DocumentType, FetchStatus, PipelineState, ReconcileStrategy


class Document(SQLModel, table=True):
    """Main document entity."""

    id: int | None = Field(default=None, primary_key=True)
    filename: str
    mime_type: str
    document_type: DocumentType = Field(default=DocumentType.UNKNOWN)
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    state: PipelineState = Field(default=PipelineState.INGESTED)
    source_uri: str | None = None
    checksum: str | None = None
    content: str | None = None  # Add content field for storing document content/base64
    tenant_id: int | None = Field(default=None, foreign_key="tenant.id")

    # Relationships
    extractions: list["Extraction"] = Relationship(back_populates="document")
    hil_corrections: list["HilCorrection"] = Relationship(back_populates="document")
    fetch_jobs: list["FetchJob"] = Relationship(back_populates="document")
    reconciliation_results: list["ReconciliationResult"] = Relationship(back_populates="document")
    final_decisions: list["FinalDecision"] = Relationship(back_populates="document")
    audit_trail: list["AuditTrail"] = Relationship(back_populates="document")


class Extraction(SQLModel, table=True):
    """Document extraction results."""

    id: int | None = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="document.id")
    raw_json: dict[str, Any] = Field(sa_column=Column(JSON))
    version: int = Field(default=1)
    provider: str
    confidence: float | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    document: Document | None = Relationship(back_populates="extractions")


class HilCorrection(SQLModel, table=True):
    """Human-in-the-loop corrections."""

    id: int | None = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="document.id")
    corrected_json: dict[str, Any] = Field(sa_column=Column(JSON))
    reviewer: str
    notes: str | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    document: Document | None = Relationship(back_populates="hil_corrections")


class FetchJob(SQLModel, table=True):
    """External data fetch jobs."""

    id: int | None = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="document.id")
    status: FetchStatus = Field(default=FetchStatus.PENDING)
    targets: list[str] = Field(sa_column=Column(JSON))
    response_payloads: dict[str, Any] = Field(sa_column=Column(JSON))
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    tenant_id: int | None = Field(default=None, foreign_key="tenant.id")

    # Relationships
    document: Document | None = Relationship(back_populates="fetch_jobs")


class ReconciliationResult(SQLModel, table=True):
    """Reconciliation results."""

    id: int | None = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="document.id")
    strategy: ReconcileStrategy
    result_json: dict[str, Any] = Field(sa_column=Column(JSON))
    score_overall: float
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    document: Document | None = Relationship(back_populates="reconciliation_results")


class FinalDecision(SQLModel, table=True):
    """Final approval/rejection decisions."""

    id: int | None = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="document.id")
    decision: Decision
    decider: str
    notes: str | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    document: Document | None = Relationship(back_populates="final_decisions")


class AuditTrail(SQLModel, table=True):
    """Audit trail for all document state changes."""

    id: int | None = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="document.id")
    actor_type: ActorType
    actor_id: str | None = None
    action: str
    from_state: PipelineState | None = None
    to_state: PipelineState | None = None
    payload: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    document: Document | None = Relationship(back_populates="audit_trail")


class RagDocument(SQLModel, table=True):
    """RAG database documents for reconciliation reference."""

    id: int | None = Field(default=None, primary_key=True)
    document_type: DocumentType
    reference_data: dict[str, Any] = Field(sa_column=Column(JSON))
    description: str | None = None
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    embedding_vector: str | None = None  # Stored as JSON string
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DocumentTypeTemplate(SQLModel, table=True):
    """Templates for document type specific fields and validation."""

    id: int | None = Field(default=None, primary_key=True)
    document_type: DocumentType
    template_name: str
    required_fields: list[str] = Field(sa_column=Column(JSON))
    optional_fields: list[str] = Field(sa_column=Column(JSON))
    field_schemas: dict[str, Any] = Field(sa_column=Column(JSON))
    validation_rules: dict[str, Any] = Field(sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DebugSession(SQLModel, table=True):
    """AI debugging sessions for pipeline analysis."""

    id: int | None = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="document.id")
    stage: str  # Pipeline stage being debugged
    debug_type: str  # Type of debug analysis
    input_data: dict[str, Any] = Field(sa_column=Column(JSON))
    ai_analysis: dict[str, Any] = Field(sa_column=Column(JSON))
    recommendations: list[str] = Field(sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# New multi-tenant & self-service configuration entities
# ---------------------------------------------------------------------------


class Tenant(SQLModel, table=True):
    """Represents a business customer (tenant) that owns documents and config."""

    id: int | None = Field(default=None, primary_key=True)
    name: str
    slug: str = Field(index=True, unique=True)
    api_key: str | None = None  # optional per-tenant auth key
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CustomDocTypeDefinition(SQLModel, table=True):
    """Tenant-specific document type with extraction instructions & output schema."""

    id: int | None = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenant.id")
    name: str  # e.g. "Handwritten Expense Form"
    description: str | None = None
    instructions: dict[str, Any] = Field(sa_column=Column(JSON))  # prompt / OCR hints
    output_schema: dict[str, Any] = Field(sa_column=Column(JSON))  # desired JSON schema
    destination_webhook: str | None = None
    pipeline_config: dict[str, Any] = Field(sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    tenant: Tenant | None = Relationship()


# Import User model from auth to ensure it's registered
from .auth import User  # noqa: E402

__all__ = [
    "Document",
    "Extraction",
    "HilCorrection",
    "FetchJob",
    "ReconciliationResult",
    "FinalDecision",
    "AuditTrail",
    "RagDocument",
    "DocumentTypeTemplate",
    "DebugSession",
    "Tenant",
    "CustomDocTypeDefinition",
    "User",
]
