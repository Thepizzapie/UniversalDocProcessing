from __future__ import annotations

from fastapi import HTTPException

from ..enums import PipelineState
from ..models import Document


def ensure_state(doc: Document, allowed: list[PipelineState]) -> None:
    if doc.state not in allowed:
        raise HTTPException(409, "Invalid state")
