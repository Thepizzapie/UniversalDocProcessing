from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel


class ExtractedField(BaseModel):
    value: Any
    confidence: Optional[float] = None
    type_hint: Optional[str] = None


ExtractedRecord = Dict[str, ExtractedField]


class CorrectedField(ExtractedField):
    correction_reason: Optional[str] = None


CorrectedRecord = Dict[str, CorrectedField]


class FetchedRecord(BaseModel):
    source: str
    payload: Dict[str, Any]


class ReconcileDiff(BaseModel):
    field: str
    extracted_value: Any = None
    fetched_value: Any = None
    match_score: float
    status: str
