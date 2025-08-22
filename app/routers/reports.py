from __future__ import annotations

from sqlmodel import select
from fastapi import APIRouter, Depends

from ..db import get_session
from .. import models

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{document_id}")
def report(document_id: int, session=Depends(get_session)):
    doc = session.get(models.Document, document_id)
    extraction = session.exec(
        select(models.Extraction)
        .where(models.Extraction.document_id == document_id)
        .order_by(models.Extraction.id.desc())
    ).first()
    correction = session.exec(
        select(models.HilCorrection)
        .where(models.HilCorrection.document_id == document_id)
        .order_by(models.HilCorrection.id.desc())
    ).first()
    fetch_job = session.exec(
        select(models.FetchJob)
        .where(models.FetchJob.document_id == document_id)
        .order_by(models.FetchJob.id.desc())
    ).first()
    recon = session.exec(
        select(models.ReconciliationResult)
        .where(models.ReconciliationResult.document_id == document_id)
        .order_by(models.ReconciliationResult.id.desc())
    ).first()
    decision = session.exec(
        select(models.FinalDecision)
        .where(models.FinalDecision.document_id == document_id)
        .order_by(models.FinalDecision.id.desc())
    ).first()
    audit_rows = session.exec(
        select(models.AuditTrail).where(models.AuditTrail.document_id == document_id)
    ).all()
    return {
        "document": doc.dict(),
        "extraction": extraction.raw_json if extraction else None,
        "correction": correction.corrected_json if correction else None,
        "fetch": fetch_job.response_payloads if fetch_job else None,
        "reconciliation": recon.result_json if recon else None,
        "decision": decision.decision if decision else None,
        "audit": [a.dict() for a in audit_rows],
    }
