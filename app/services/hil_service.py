from __future__ import annotations


from .. import models
from ..enums import ActorType, PipelineState
from . import audit


def apply_corrections(
    session, document_id: int, corrected: models.JSON, reviewer: str = "reviewer"
) -> models.HilCorrection:
    doc = session.get(models.Document, document_id)
    corr = models.HilCorrection(
        document_id=document_id, corrected_json=corrected, reviewer=reviewer
    )
    session.add(corr)
    prev_state = doc.state
    doc.state = PipelineState.FETCH_PENDING
    session.add(doc)
    session.commit()
    audit.log(
        session,
        document_id=document_id,
        action="HIL_CONFIRMED",
        from_state=prev_state,
        to_state=doc.state,
        actor_type=ActorType.USER,
        actor_id=reviewer,
        payload=corrected,
    )
    return corr
