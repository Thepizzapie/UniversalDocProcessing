from __future__ import annotations

from typing import Optional

from sqlmodel import SQLModel, Field, create_engine, Session


class InvoiceEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    invoice_number: str
    invoice_date: str
    vendor_name: str
    customer_name: str
    total_amount: float
    currency: str


class ReceiptEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    transaction_id: str
    purchase_date: str
    merchant_name: str
    total_paid: float
    payment_method: str
    notes: Optional[str] = None


class LoadSheetEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    load_number: str
    pickup_location: str
    dropoff_location: str
    pickup_date: str
    dropoff_date: str
    carrier_name: str
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




