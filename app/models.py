from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlmodel import JSON, Field, SQLModel

from .enums import ActorType, Decision, PipelineState


class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    mime_type: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    state: PipelineState = Field(default=PipelineState.INGESTED)
    source_uri: Optional[str] = None
    checksum: Optional[str] = None


class Extraction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int
    raw_json: Dict[str, Any] = Field(sa_type=JSON)
    version: str
    provider: str
    confidence: Optional[float] = None


class HilCorrection(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int
    corrected_json: Dict[str, Any] = Field(sa_type=JSON)
    reviewer: str
    notes: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class FetchJob(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int
    status: str
    targets: List[str] = Field(sa_type=JSON)
    response_payloads: Dict[str, Any] = Field(sa_type=JSON, default={})
    started_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None


class ReconciliationResult(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int
    strategy: str
    result_json: List[Dict[str, Any]] = Field(sa_type=JSON)
    score_overall: float
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FinalDecision(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int
    decision: Decision
    decider: str
    notes: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AuditTrail(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int
    actor_type: ActorType
    actor_id: Optional[str] = None
    action: str
    from_state: Optional[PipelineState] = None
    to_state: Optional[PipelineState] = None
    payload: Optional[Dict[str, Any]] = Field(sa_type=JSON, default=None)
    ts: datetime = Field(default_factory=datetime.utcnow)
