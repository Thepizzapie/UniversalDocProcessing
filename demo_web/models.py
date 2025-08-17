from __future__ import annotations

from typing import Optional

from sqlmodel import SQLModel, Field, create_engine, Session


class InvoiceEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    invoice_number: str
    invoice_date: str
    due_date: Optional[str] = None
    vendor_name: str
    vendor_address: Optional[str] = None
    customer_name: str
    billing_address: Optional[str] = None
    subtotal: Optional[float] = None
    tax_amount: Optional[float] = None
    discount: Optional[float] = None
    total_amount: float
    currency: str
    notes: Optional[str] = None


class ReceiptEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    transaction_id: str
    purchase_date: str
    merchant_name: str
    subtotal: Optional[float] = None
    tax_amount: Optional[float] = None
    total_paid: float
    payment_method: str
    last4: Optional[str] = None
    notes: Optional[str] = None


class LoadSheetEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    load_number: str
    reference_number: Optional[str] = None
    pickup_location: str
    dropoff_location: str
    pickup_date: str
    dropoff_date: str
    carrier_name: str
    equipment_type: Optional[str] = None
    pallet_count: Optional[int] = None
    pieces: Optional[int] = None
    commodity: Optional[str] = None
    total_weight_lbs: float


def get_engine(db_url: str = "sqlite:///./demo.db"):
    return create_engine(db_url, echo=False)


def init_db(engine=None) -> None:
    if engine is None:
        engine = get_engine()
    SQLModel.metadata.create_all(engine)


def get_session(engine=None) -> Session:
    if engine is None:
        engine = get_engine()
    return Session(engine)

