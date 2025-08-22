from __future__ import annotations

from typing import List

from sqlmodel import select

from .. import models
from ..adapters.external_apis import example_vendor
from ..enums import ActorType, PipelineState
from . import audit


def run_fetch(session, document_id: int, targets: List[str]) -> models.FetchJob:
    existing = session.exec(
        select(models.FetchJob)
        .where(models.FetchJob.document_id == document_id)
        .order_by(models.FetchJob.id.desc())
    ).first()
    if existing:
        return existing
    doc = session.get(models.Document, document_id)
    corr = session.exec(
        select(models.HilCorrection)
        .where(models.HilCorrection.document_id == document_id)
        .order_by(models.HilCorrection.id.desc())
    ).first()
    job = models.FetchJob(
        document_id=document_id, status="done", targets=targets, response_payloads={}
    )
    for target in targets:
        if target == "example_vendor":
            fetched = example_vendor.fetch(doc, corr.corrected_json if corr else {})
            job.response_payloads[target] = fetched["payload"]
    session.add(job)
    prev_state = doc.state
    doc.state = PipelineState.FETCHED
    session.add(doc)
    session.commit()
    audit.log(
        session,
        document_id=document_id,
        action="FETCHED",
        from_state=prev_state,
        to_state=doc.state,
        actor_type=ActorType.SYSTEM,
        payload={"targets": targets},
    )
    return job
