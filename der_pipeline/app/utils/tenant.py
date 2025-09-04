from typing import Optional

from fastapi import Header, HTTPException
from sqlmodel import Session, select

from ..db import get_session_sync
from ..models import Tenant


async def get_tenant_id(x_tenant_id: Optional[int] = Header(default=None)) -> int:
    """Resolve tenant ID from header. Raise 400 if missing/invalid."""
    if x_tenant_id is None:
        raise HTTPException(status_code=400, detail="X-Tenant-ID header is required")

    # Validate tenant exists
    with get_session_sync() as session:
        tenant = session.get(Tenant, x_tenant_id)
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

    return x_tenant_id
