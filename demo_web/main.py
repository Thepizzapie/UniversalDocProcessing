from __future__ import annotations

from typing import Optional
import os
import requests

from fastapi import FastAPI, APIRouter, Depends, Form, Request, File, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from .models import (
    get_engine,
    get_session,
    init_db,
    InvoiceEntry,
    ReceiptEntry,
    LoadSheetEntry,
)


app = FastAPI(title="Demo Data Warehouse", version="0.1.0")
templates = Jinja2Templates(directory="demo_web/templates")
router = APIRouter()


def get_db() -> Session:
    engine = get_engine()
    init_db(engine)
    return get_session(engine)


@router.get("/", response_class=HTMLResponse)
def home(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("home.html", {"request": request})


@router.get("/upload", response_class=HTMLResponse)
def universal_upload_form(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("universal_upload.html", {"request": request})


@router.post("/upload")
def universal_upload(
    request: Request,
    files: list[UploadFile] = File(...),
    return_text: str = Form("false"),
):
    """Universal uploader: do not force doc_type; let the API classify and extract.

    Shows the raw classification and extracted fields for review.
    """
    base_url = os.environ.get("DOC_API_BASE_URL", "http://127.0.0.1:8080")

    # Build payloads for single or multi
    single = len(files) == 1
    if single:
        form_files = {
            "file": (
                files[0].filename or "upload",
                files[0].file,
                files[0].content_type or "application/octet-stream",
            )
        }
        data = {
            # Do not set doc_type → the API will classify
            "return_text": return_text,
            "use_agents": "true",
            "refine": "true",
            "ocr_fallback": "true",
        }
    else:
        # For batch, API expects multiple parts named "files"
        form_files = [("files", (
            f.filename or "upload",
            f.file,
            f.content_type or "application/octet-stream",
        )) for f in files]
        data = {
            "use_agents": "true",
            "refine": "true",
        }
    headers = {}
    token = os.environ.get("DOC_API_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        endpoint = "/classify-extract" if single else "/classify-extract-batch"
        resp = requests.post(
            f"{base_url}{endpoint}",
            files=form_files,
            data=data,
            headers=headers,
            timeout=300,
        )
        resp.raise_for_status()
    except Exception as err:
        from fastapi.responses import HTMLResponse

        msg = (
            f"Upload failed contacting Document API at {base_url}. "
            f"Error: {err}. Ensure the API is running (python -m uvicorn service.api:app --port 8080) "
            f"or set DOC_API_BASE_URL."
        )
        return HTMLResponse(
            f"<p>{msg}</p><p><a href='/upload'>Back</a></p>", status_code=502
        )

    payload = resp.json()
    if single:
        cls = payload.get("classification") or {}
        data_out = payload.get("data") or {}
        raw_text = payload.get("raw_text") or ""
        errors = payload.get("errors") or []
        return templates.TemplateResponse(
            "universal_result.html",
            {
                "request": request,
                "classification": cls,
                "data": data_out,
                "raw_text": raw_text,
                "errors": errors,
                "filename": files[0].filename or "upload",
            },
        )
    else:
        # Batch results list
        return templates.TemplateResponse(
            "universal_batch_result.html",
            {
                "request": request,
                "results": payload,
            },
        )


@router.get("/invoices", response_class=HTMLResponse)
def list_invoices(request: Request, db: Session = Depends(get_db)) -> HTMLResponse:
    items = db.exec(select(InvoiceEntry)).all()
    return templates.TemplateResponse("invoices_list.html", {"request": request, "items": items})


@router.get("/invoices/new", response_class=HTMLResponse)
def new_invoice(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("invoices_new.html", {"request": request})


@router.post("/invoices/new")
def create_invoice(
    invoice_number: str = Form(...),
    invoice_date: str = Form(...),
    vendor_name: str = Form(...),
    customer_name: str = Form(...),
    total_amount: float = Form(...),
    currency: str = Form(...),
    db: Session = Depends(get_db),
):
    item = InvoiceEntry(
        invoice_number=invoice_number,
        invoice_date=invoice_date,
        vendor_name=vendor_name,
        customer_name=customer_name,
        total_amount=total_amount,
        currency=currency,
    )
    db.add(item)
    db.commit()
    return RedirectResponse(url="/invoices", status_code=303)


@router.get("/invoices/upload", response_class=HTMLResponse)
def upload_invoice_form(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("invoices_upload.html", {"request": request})


@router.post("/invoices/upload")
def upload_invoice(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload an invoice image/PDF, send to the document API, and save to DB."""
    base_url = os.environ.get("DOC_API_BASE_URL", "http://127.0.0.1:8080")

    files = {
        "file": (
            file.filename or "upload",
            file.file,
            file.content_type or "application/octet-stream",
        )
    }
    data = {
        # Force 'invoice' type for proper field mapping
        "doc_type": "invoice",
        "return_text": "false",
        "use_agents": "true",
        "refine": "true",
        "ocr_fallback": "true",
    }
    headers = {}
    token = os.environ.get("DOC_API_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        resp = requests.post(
            f"{base_url}/classify-extract",
            files=files,
            data=data,
            headers=headers,
            timeout=120,
        )
        resp.raise_for_status()
    except Exception as err:
        from fastapi.responses import HTMLResponse

        msg = (
            f"Upload failed contacting Document API at {base_url}. "
            f"Error: {err}. Ensure the API is running (python -m uvicorn service.api:app --port 8080) "
            f"or set DOC_API_BASE_URL."
        )
        return HTMLResponse(
            f"<p>{msg}</p><p><a href='/invoices/upload'>Back</a></p>", status_code=502
        )
    payload = resp.json()
    extracted = payload.get("data") or {}

    # Map extracted fields to invoice database fields
    invoice_number = (
        _pick_first(
            extracted,
            [
                "Invoice Number",
                "invoice_number",
                "Invoice ID",
                "Number",
            ],
        )
        or ""
    )

    invoice_date = (
        _pick_first(
            extracted,
            [
                "Invoice Date",
                "invoice_date",
                "Date",
                "Issue Date",
            ],
        )
        or ""
    )

    vendor_name = (
        _pick_first(
            extracted,
            [
                "Vendor Name",
                "vendor_name",
                "Vendor",
                "Company",
                "From",
            ],
        )
        or ""
    )

    customer_name = (
        _pick_first(
            extracted,
            [
                "Customer Name",
                "customer_name",
                "Customer",
                "Bill To",
                "To",
            ],
        )
        or ""
    )

    # Optional invoice fields
    due_date = _pick_first(extracted, ["due_date", "Due Date"]) or None
    vendor_address = _pick_first(extracted, ["vendor_address", "Vendor Address"]) or None
    billing_address = _pick_first(extracted, ["billing_address", "Billing Address"]) or None
    subtotal_str = _pick_first(extracted, ["subtotal", "Subtotal"]) or ""
    tax_str = _pick_first(extracted, ["tax_amount", "Tax", "Sales Tax"]) or ""
    discount_str = _pick_first(extracted, ["discount", "Discount"]) or ""

    # Extract total amount and currency
    total_amount_str = (
        _pick_first(
            extracted,
            [
                "Total Amount Due",
                "total_amount",
                "Total",
                "Amount Due",
                "Grand Total",
            ],
        )
        or ""
    )

    # Extract numeric amount if the field includes currency symbols
    import re as _re

    amount_match = _re.search(r"[-+]?[0-9]*\.?[0-9]+", str(total_amount_str))
    total_amount = float(amount_match.group(0)) if amount_match else 0.0
    def _to_float(s: str) -> float:
        m = _re.search(r"[-+]?[0-9]*\.?[0-9]+", str(s))
        return float(m.group(0)) if m else 0.0
    subtotal = _to_float(subtotal_str) if subtotal_str else None
    tax_amount = _to_float(tax_str) if tax_str else None
    discount = _to_float(discount_str) if discount_str else None

    # Extract currency symbol or default to USD
    currency_match = _re.search(r"[$€£¥₹]", str(total_amount_str))
    if currency_match:
        currency_map = {"$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₹": "INR"}
        currency = currency_map.get(currency_match.group(0), "USD")
    else:
        currency = _pick_first(extracted, ["Currency", "currency"]) or "USD"

    item = InvoiceEntry(
        invoice_number=invoice_number or (file.filename or ""),
        invoice_date=invoice_date,
        due_date=due_date,
        vendor_name=vendor_name,
        vendor_address=vendor_address,
        customer_name=customer_name,
        billing_address=billing_address,
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount=discount,
        total_amount=total_amount,
        currency=currency,
        notes=None,
    )
    db.add(item)
    db.commit()
    return RedirectResponse(url="/invoices", status_code=303)


@router.get("/receipts", response_class=HTMLResponse)
def list_receipts(request: Request, db: Session = Depends(get_db)) -> HTMLResponse:
    items = db.exec(select(ReceiptEntry)).all()
    return templates.TemplateResponse("receipts_list.html", {"request": request, "items": items})


@router.get("/receipts/new", response_class=HTMLResponse)
def new_receipt(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("receipts_new.html", {"request": request})


@router.post("/receipts/new")
def create_receipt(
    transaction_id: str = Form(...),
    purchase_date: str = Form(...),
    merchant_name: str = Form(...),
    total_paid: float = Form(...),
    payment_method: str = Form(...),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    item = ReceiptEntry(
        transaction_id=transaction_id,
        purchase_date=purchase_date,
        merchant_name=merchant_name,
        total_paid=total_paid,
        payment_method=payment_method,
        notes=notes,
    )
    db.add(item)
    db.commit()
    return RedirectResponse(url="/receipts", status_code=303)


@router.get("/receipts/upload", response_class=HTMLResponse)
def upload_receipt_form(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("receipts_upload.html", {"request": request})


def _pick_first(data: dict, keys: list[str]) -> Optional[str]:
    for key in keys:
        value = data.get(key)
        if value not in (None, ""):
            return str(value)
    return None


@router.post("/receipts/upload")
def upload_receipt(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a receipt image/PDF, send to the document API, and save to DB."""
    base_url = os.environ.get("DOC_API_BASE_URL", "http://127.0.0.1:8080")

    files = {
        "file": (
            file.filename or "upload",
            file.file,
            file.content_type or "application/octet-stream",
        )
    }
    data = {
        # Prefer forcing 'receipt' to keep mapping predictable
        "doc_type": "receipt",
        "return_text": "false",
        "use_agents": "true",
        "refine": "true",
        "ocr_fallback": "true",
    }
    headers = {}
    token = os.environ.get("DOC_API_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        resp = requests.post(
            f"{base_url}/classify-extract",
            files=files,
            data=data,
            headers=headers,
            timeout=120,
        )
        resp.raise_for_status()
    except Exception as err:
        from fastapi.responses import HTMLResponse

        msg = (
            f"Upload failed contacting Document API at {base_url}. "
            f"Error: {err}. Ensure the API is running (python -m uvicorn service.api:app --port 8080) "
            f"or set DOC_API_BASE_URL."
        )
        return HTMLResponse(
            f"<p>{msg}</p><p><a href='/receipts/upload'>Back</a></p>", status_code=502
        )
    payload = resp.json()
    extracted = payload.get("data") or {}

    transaction_id = (
        _pick_first(
            extracted,
            [
                "Receipt Number or Transaction ID",
                "Transaction ID",
                "Receipt Number",
                "receipt_number",
                "transaction_id",
            ],
        )
        or ""
    )

    purchase_date = (
        _pick_first(
            extracted,
            [
                "Purchase Date",
                "Date",
                "purchase_date",
                "date",
            ],
        )
        or ""
    )

    merchant_name = (
        _pick_first(
            extracted,
            [
                "Merchant Name",
                "merchant_name",
                "Merchant",
                "Store",
            ],
        )
        or ""
    )

    total_paid_str = (
        _pick_first(
            extracted,
            [
                "Total Paid",
                "Total Amount",
                "Total",
                "total_paid",
            ],
        )
        or ""
    )
    # Extract numeric amount if the field includes currency symbols
    import re as _re

    m = _re.search(r"[-+]?[0-9]*\.?[0-9]+", str(total_paid_str))
    total_paid = float(m.group(0)) if m else 0.0

    payment_method = (
        _pick_first(
            extracted,
            [
                "Payment Method",
                "payment_method",
            ],
        )
        or "Unknown"
    )
    subtotal_r = _pick_first(extracted, ["subtotal", "Subtotal"]) or None
    tax_r = _pick_first(extracted, ["tax_amount", "Tax", "Sales Tax"]) or None
    last4 = _pick_first(extracted, ["last4", "Last4", "Last 4"]) or None

    notes_parts: list[str] = []
    for key in [
        "Itemized Purchases",
        "Items",
        "Tax",
        "Sales Tax (9.5%)",
        "Subtotal",
        "raw_text",
    ]:
        v = extracted.get(key)
        if v:
            notes_parts.append(f"{key}: {v}")
    notes = "; ".join(notes_parts)[:500]

    item = ReceiptEntry(
        transaction_id=transaction_id or (file.filename or ""),
        purchase_date=purchase_date,
        merchant_name=merchant_name,
        subtotal=_to_float(subtotal_r) if subtotal_r else None,
        tax_amount=_to_float(tax_r) if tax_r else None,
        total_paid=total_paid,
        payment_method=payment_method,
        last4=last4,
        notes=notes or None,
    )
    db.add(item)
    db.commit()
    return RedirectResponse(url="/receipts", status_code=303)


@router.get("/load-sheets", response_class=HTMLResponse)
def list_load_sheets(request: Request, db: Session = Depends(get_db)) -> HTMLResponse:
    items = db.exec(select(LoadSheetEntry)).all()
    return templates.TemplateResponse("loads_list.html", {"request": request, "items": items})


@router.get("/load-sheets/new", response_class=HTMLResponse)
def new_load_sheet(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("loads_new.html", {"request": request})


@router.post("/load-sheets/new")
def create_load_sheet(
    load_number: str = Form(...),
    pickup_location: str = Form(...),
    dropoff_location: str = Form(...),
    pickup_date: str = Form(...),
    dropoff_date: str = Form(...),
    carrier_name: str = Form(...),
    total_weight_lbs: float = Form(...),
    db: Session = Depends(get_db),
):
    item = LoadSheetEntry(
        load_number=load_number,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        pickup_date=pickup_date,
        dropoff_date=dropoff_date,
        carrier_name=carrier_name,
        total_weight_lbs=total_weight_lbs,
    )
    db.add(item)
    db.commit()
    return RedirectResponse(url="/load-sheets", status_code=303)


app.include_router(router)
