"""Accounting system API connector for financial data validation."""

import random
from datetime import datetime, timedelta
from typing import Any

from loguru import logger


def fetch_data(api_config: dict[str, Any], document_data: dict[str, Any]) -> dict[str, Any]:
    """Fetch data from accounting system API.

    Args:
        api_config: API configuration (endpoint, credentials, etc.)
        document_data: Document data for lookup

    Returns:
        Accounting system data
    """

    endpoint = api_config.get("endpoint", "https://api.demo-accounting.com")
    api_config.get("api_key", "demo_key")

    logger.info(f"Fetching accounting data from {endpoint}")

    try:
        # Simulate accounting API responses based on document type
        doc_type = document_data.get("document_type", "unknown")

        if doc_type.lower() == "invoice":
            results = _simulate_invoice_accounting_data(document_data)
        elif doc_type.lower() == "receipt":
            results = _simulate_expense_accounting_data(document_data)
        else:
            results = _simulate_general_ledger_data(document_data)

        return {
            "source": "accounting_api",
            "status": "success",
            "data": results,
            "api_endpoint": endpoint,
            "fetch_timestamp": datetime.utcnow().isoformat(),
            "metadata": {
                "api_version": "v2.1",
                "response_time_ms": random.randint(100, 500),
                "rate_limit_remaining": random.randint(950, 1000),
                "request_id": f"req_{random.randint(100000, 999999)}",
            },
        }

    except Exception as e:
        logger.error(f"Accounting API fetch failed: {e}")
        return {
            "source": "accounting_api",
            "status": "error",
            "error": str(e),
            "api_endpoint": endpoint,
            "fetch_timestamp": datetime.utcnow().isoformat(),
        }


def _simulate_invoice_accounting_data(document_data: dict[str, Any]) -> dict[str, Any]:
    """Simulate invoice-related accounting data."""
    invoice_number = f"INV-{random.randint(1000, 9999)}"

    return {
        "invoice": {
            "invoice_number": invoice_number,
            "status": random.choice(["draft", "sent", "paid", "overdue"]),
            "amount": round(random.uniform(100, 10000), 2),
            "currency": "USD",
            "issue_date": (datetime.now() - timedelta(days=random.randint(1, 30)))
            .date()
            .isoformat(),
            "due_date": (datetime.now() + timedelta(days=random.randint(1, 60))).date().isoformat(),
            "payment_terms": "NET30",
        },
        "vendor": {
            "vendor_id": f"VND-{random.randint(1000, 9999)}",
            "name": "Professional Services Inc.",
            "status": "active",
            "payment_history": {
                "total_transactions": random.randint(10, 100),
                "avg_payment_days": random.randint(15, 45),
                "late_payments": random.randint(0, 5),
            },
        },
        "accounting": {
            "account_payable": round(random.uniform(1000, 50000), 2),
            "chart_of_accounts": {
                "expense_account": "5000 - Professional Services",
                "liability_account": "2000 - Accounts Payable",
            },
            "budget_impact": {
                "budget_line": "Professional Services - Q3",
                "remaining_budget": round(random.uniform(5000, 25000), 2),
                "utilization_percent": round(random.uniform(0.4, 0.9), 2),
            },
        },
    }


def _simulate_expense_accounting_data(document_data: dict[str, Any]) -> dict[str, Any]:
    """Simulate expense-related accounting data."""
    transaction_id = f"TXN-{random.randint(10000, 99999)}"

    return {
        "transaction": {
            "transaction_id": transaction_id,
            "amount": round(random.uniform(10, 500), 2),
            "currency": "USD",
            "date": datetime.now().date().isoformat(),
            "category": random.choice(["office_supplies", "travel", "meals", "equipment"]),
            "status": "pending_approval",
        },
        "merchant": {
            "merchant_name": "Office Supply Store",
            "merchant_category": "office_supplies",
            "trusted_vendor": True,
            "transaction_history": random.randint(5, 50),
        },
        "policy": {
            "within_policy": random.choice([True, False]),
            "policy_limit": round(random.uniform(100, 1000), 2),
            "requires_receipt": True,
            "approval_required": random.choice([True, False]),
        },
        "accounting": {
            "expense_account": "6100 - Office Expenses",
            "cost_center": "Administration",
            "project_code": f"PRJ-{random.randint(100, 999)}",
            "tax_deductible": True,
        },
    }


def _simulate_general_ledger_data(document_data: dict[str, Any]) -> dict[str, Any]:
    """Simulate general ledger data."""

    return {
        "ledger_entry": {
            "entry_id": f"GL-{random.randint(10000, 99999)}",
            "posting_date": datetime.now().date().isoformat(),
            "amount": round(random.uniform(100, 5000), 2),
            "description": "Document processing entry",
            "reference": document_data.get("filename", "unknown_document"),
        },
        "accounts": {
            "debit_account": "1200 - Accounts Receivable",
            "credit_account": "4000 - Revenue",
            "balance_impact": round(random.uniform(-1000, 1000), 2),
        },
        "audit_trail": {
            "created_by": "system_user",
            "created_date": datetime.now().isoformat(),
            "last_modified": datetime.now().isoformat(),
            "audit_flags": [],
        },
    }

