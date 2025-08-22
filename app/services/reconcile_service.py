from __future__ import annotations

from sqlmodel import select

from .. import models
from ..enums import ActorType, PipelineState
from ..utils import diff
from . import audit


def reconcile(session, document_id: int, strategy: str = "loose") -> models.ReconciliationResult:
    existing = session.exec(
        select(models.ReconciliationResult)
        .where(models.ReconciliationResult.document_id == document_id)
        .order_by(models.ReconciliationResult.id.desc())
    ).first()
    if existing:
        return existing
    doc = session.get(models.Document, document_id)
    corr = session.exec(
        select(models.HilCorrection)
        .where(models.HilCorrection.document_id == document_id)
        .order_by(models.HilCorrection.id.desc())
    ).first()
    fetch_job = session.exec(
        select(models.FetchJob)
        .where(models.FetchJob.document_id == document_id)
        .order_by(models.FetchJob.id.desc())
    ).first()
    extracted = corr.corrected_json if corr else {}
    fetched = {}
    if fetch_job:
        for payload in fetch_job.response_payloads.values():
            fetched.update(payload)
    diffs, score = diff.reconcile_records(extracted, fetched, strategy)
    result = models.ReconciliationResult(
        document_id=document_id,
        strategy=strategy,
        result_json=diffs,
        score_overall=score,
    )
    session.add(result)
    prev_state = doc.state
    doc.state = PipelineState.FINAL_REVIEW
    session.add(doc)
    session.commit()
    audit.log(
        session,
        document_id=document_id,
        action="RECONCILED",
        from_state=prev_state,
        to_state=doc.state,
        actor_type=ActorType.SYSTEM,
        payload={"score": score},
    )
    return result
