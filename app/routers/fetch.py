from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..db import get_session
from .. import models
from ..services import fetch_service

router = APIRouter(prefix="/fetch", tags=["fetch"])


class FetchRequest(BaseModel):
    targets: Optional[list[str]] = None


@router.post("/{document_id}")
def fetch(document_id: int, body: FetchRequest, session=Depends(get_session)):
    job = fetch_service.run_fetch(session, document_id, body.targets or ["example_vendor"])
    doc = session.get(models.Document, document_id)
    summary = list(job.response_payloads.keys())
    return {"state": doc.state, "fetched_summary": summary}
