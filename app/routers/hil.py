from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlmodel import select

from ..db import get_session
from ..enums import PipelineState
from .. import models
from ..services import hil_service, fetch_service, queue

router = APIRouter(prefix="/hil", tags=["hil"])


@router.get("/{document_id}")
def get_hil(document_id: int, session=Depends(get_session)):
    doc = session.get(models.Document, document_id)
    corr = session.exec(
        select(models.HilCorrection)
        .where(models.HilCorrection.document_id == document_id)
        .order_by(models.HilCorrection.id.desc())
    ).first()
    payload = corr.corrected_json if corr else {}
    if not payload:
        extraction = session.exec(
            select(models.Extraction)
            .where(models.Extraction.document_id == document_id)
            .order_by(models.Extraction.id.desc())
        ).first()
        if extraction:
            payload = extraction.raw_json
    return {"document_id": document_id, "state": doc.state, "payload": payload}


class HilBody(BaseModel):
    corrected: dict
    targets: Optional[list[str]] = None


@router.put("/{document_id}")
def put_hil(
    document_id: int,
    body: HilBody,
    background: BackgroundTasks,
    session=Depends(get_session),
):
    hil_service.apply_corrections(session, document_id, body.corrected)
    q = queue.InProcessQueue(
        background,
        {
            "fetch": lambda document_id, targets: fetch_service.run_fetch(
                session, document_id, targets
            )
        },
    )
    q.enqueue("fetch", {"document_id": document_id, "targets": body.targets or ["example_vendor"]})
    return {"state": PipelineState.FETCH_PENDING}
