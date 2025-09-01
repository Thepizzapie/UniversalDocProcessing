from typing import List

from fastapi import APIRouter, HTTPException, status
from sqlmodel import Session, select

from ..db import get_session
from ..models import Tenant

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.post("/", response_model=Tenant, status_code=status.HTTP_201_CREATED)
def create_tenant(tenant: Tenant):
    """Create a new tenant (business customer)."""
    with Session(get_session().bind) as session:
        # Ensure slug uniqueness
        existing = session.exec(select(Tenant).where(Tenant.slug == tenant.slug)).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slug already exists")

        session.add(tenant)
        session.commit()
        session.refresh(tenant)
        return tenant


@router.get("/", response_model=List[Tenant])
def list_tenants():
    """List all tenants."""
    with Session(get_session().bind) as session:
        return session.exec(select(Tenant)).all()


@router.get("/{tenant_id}", response_model=Tenant)
def get_tenant(tenant_id: int):
    with Session(get_session().bind) as session:
        tenant = session.get(Tenant, tenant_id)
        if not tenant:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
        return tenant


@router.put("/{tenant_id}", response_model=Tenant)
def update_tenant(tenant_id: int, update: Tenant):
    with Session(get_session().bind) as session:
        tenant = session.get(Tenant, tenant_id)
        if not tenant:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

        update_data = update.dict(exclude_unset=True)
        for key, val in update_data.items():
            setattr(tenant, key, val)
        session.add(tenant)
        session.commit()
        session.refresh(tenant)
        return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(tenant_id: int):
    with Session(get_session().bind) as session:
        tenant = session.get(Tenant, tenant_id)
        if not tenant:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
        session.delete(tenant)
        session.commit()
