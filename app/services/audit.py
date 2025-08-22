from __future__ import annotations

from typing import Any, Optional

from .. import models
from ..enums import ActorType, PipelineState


def log(
    session,
    document_id: int,
    action: str,
    from_state: Optional[PipelineState],
    to_state: Optional[PipelineState],
    actor_type: ActorType,
    actor_id: str | None = None,
    payload: Any | None = None,
) -> models.AuditTrail:
    entry = models.AuditTrail(
        document_id=document_id,
        action=action,
        from_state=from_state,
        to_state=to_state,
        actor_type=actor_type,
        actor_id=actor_id,
        payload=payload,
    )
    session.add(entry)
    session.commit()
    return entry
