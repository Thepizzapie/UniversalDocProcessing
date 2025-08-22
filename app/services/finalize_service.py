from __future__ import annotations

from .. import models
from ..enums import ActorType, Decision, PipelineState
from . import audit


def finalize(
    session, document_id: int, decision: Decision, decider: str, notes: str | None = None
) -> models.FinalDecision:
    doc = session.get(models.Document, document_id)
    if doc.state in {PipelineState.APPROVED, PipelineState.REJECTED}:
        raise ValueError("Document already finalized")
    final = models.FinalDecision(
        document_id=document_id, decision=decision, decider=decider, notes=notes
    )
    session.add(final)
    prev_state = doc.state
    doc.state = PipelineState.APPROVED if decision == Decision.APPROVED else PipelineState.REJECTED
    session.add(doc)
    session.commit()
    audit.log(
        session,
        document_id=document_id,
        action="FINALIZED",
        from_state=prev_state,
        to_state=doc.state,
        actor_type=ActorType.USER,
        actor_id=decider,
        payload={"decision": decision, "notes": notes},
    )
    return final
