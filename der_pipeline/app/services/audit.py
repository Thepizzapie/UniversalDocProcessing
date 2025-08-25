"""Audit trail service for tracking all document state changes."""

from typing import Any

from sqlalchemy.orm import Session

from ..db import get_session_sync
from ..enums import ActorType, PipelineState
from ..models import AuditTrail


class AuditService:
    """Service for managing audit trails."""

    @staticmethod
    def log(
        document_id: int,
        action: str,
        from_state: PipelineState | None = None,
        to_state: PipelineState | None = None,
        actor_type: ActorType = ActorType.SYSTEM,
        actor_id: str | None = None,
        payload: dict[str, Any] | None = None,
        session: Session | None = None,
    ) -> AuditTrail:
        """Log an audit event."""
        audit_entry = AuditTrail(
            document_id=document_id,
            actor_type=actor_type,
            actor_id=actor_id,
            action=action,
            from_state=from_state,
            to_state=to_state,
            payload=payload,
        )

        if session:
            session.add(audit_entry)
            session.commit()
            session.refresh(audit_entry)
        else:
            with get_session_sync() as db_session:
                db_session.add(audit_entry)
                db_session.commit()
                db_session.refresh(audit_entry)

        return audit_entry

    @staticmethod
    def get_audit_trail(document_id: int) -> list[AuditTrail]:
        """Get complete audit trail for a document."""
        with get_session_sync() as session:
            return (
                session.query(AuditTrail)
                .filter(AuditTrail.document_id == document_id)
                .order_by(AuditTrail.timestamp)
                .all()
            )


def log_audit_event(
    document_id: int,
    action: str,
    from_state: PipelineState | None = None,
    to_state: PipelineState | None = None,
    actor_type: ActorType = ActorType.SYSTEM,
    actor_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> AuditTrail:
    """Convenience function to log audit events."""
    return AuditService.log(
        document_id=document_id,
        action=action,
        from_state=from_state,
        to_state=to_state,
        actor_type=actor_type,
        actor_id=actor_id,
        payload=payload,
    )
