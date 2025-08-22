from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..db import get_session
from ..enums import Decision
from ..services import finalize_service
from .. import models

router = APIRouter(prefix="/finalize", tags=["finalize"])


class FinalizeRequest(BaseModel):
    decision: Decision
    notes: str | None = None


@router.post("/{document_id}")
def finalize(document_id: int, body: FinalizeRequest, session=Depends(get_session)):
    try:
        finalize_service.finalize(session, document_id, body.decision, "decider", body.notes)
    except ValueError:
        raise HTTPException(status_code=409, detail="Document already finalized")
    doc = session.get(models.Document, document_id)
    return {"state": doc.state}
