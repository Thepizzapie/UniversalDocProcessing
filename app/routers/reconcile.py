from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..db import get_session
from .. import models
from ..services import reconcile_service

router = APIRouter(prefix="/reconcile", tags=["reconcile"])


class ReconcileRequest(BaseModel):
    strategy: str = "loose"
    thresholds: Optional[dict] = None


@router.post("/{document_id}")
def reconcile(document_id: int, body: ReconcileRequest, session=Depends(get_session)):
    result = reconcile_service.reconcile(session, document_id, body.strategy)
    doc = session.get(models.Document, document_id)
    return {
        "state": doc.state,
        "result": result.result_json,
        "score_overall": result.score_overall,
    }
