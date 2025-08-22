from __future__ import annotations

import base64
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel

from ..db import get_session
from ..enums import ActorType, PipelineState
from .. import models
from ..services import audit, extraction

router = APIRouter(prefix="/ingest", tags=["ingest"])


class IngestRequest(BaseModel):
    filename: str
    mime_type: str
    base64_content: Optional[str] = None
    url: Optional[str] = None


@router.post("")
def ingest(body: IngestRequest, background: BackgroundTasks, session=Depends(get_session)):
    content = base64.b64decode(body.base64_content or "")
    doc = models.Document(filename=body.filename, mime_type=body.mime_type)
    session.add(doc)
    session.commit()
    session.refresh(doc)
    extracted = extraction.extract(doc, content)
    extraction_row = models.Extraction(
        document_id=doc.id,
        raw_json={k: v.model_dump() for k, v in extracted.items()},
        version="1.0",
        provider="stub",
    )
    session.add(extraction_row)
    prev_state = doc.state
    doc.state = PipelineState.HIL_REQUIRED
    session.add(doc)
    session.commit()
    audit.log(
        session,
        document_id=doc.id,
        action="INGESTED",
        from_state=prev_state,
        to_state=doc.state,
        actor_type=ActorType.SYSTEM,
        payload={"filename": doc.filename},
    )
    return {
        "document_id": doc.id,
        "state": doc.state,
        "extracted": {k: v.model_dump() for k, v in extracted.items()},
    }
