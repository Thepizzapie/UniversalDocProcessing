"""Dummy JSON connector for testing fetch operations."""

import random
from typing import Any


def fetch_data(document_data: dict[str, Any]) -> dict[str, Any]:
    """Fetch dummy data from a simulated JSON API."""

    # Simulate different response types based on document content
    doc_type = document_data.get("document_type", "unknown")

    if doc_type.lower() == "invoice":
        return _generate_invoice_data(document_data)
    elif doc_type.lower() == "receipt":
        return _generate_receipt_data(document_data)
    elif doc_type.lower() == "entry_exit_log":
        return _generate_entry_exit_data(document_data)
    else:
        return _generate_generic_data(document_data)


def _generate_invoice_data(document_data: dict[str, Any]) -> dict[str, Any]:
    """Generate dummy invoice validation data."""
    return {
        "source": "dummy_json",
        "status": "found",
        "data": {
            "invoice_number": f"INV-{random.randint(1000, 9999)}",
            "vendor_name": "Verified Vendor Inc.",
            "total_amount": round(random.uniform(100, 10000), 2),
            "invoice_date": "2024-08-20",
            "payment_status": random.choice(["paid", "pending", "overdue"]),
            "vendor_verified": True,
            "tax_rate": 0.08,
            "currency": "USD",
        },
        "confidence": 0.9,
        "fetch_timestamp": "2024-08-24T10:30:00Z",
        "metadata": {
            "source_system": "ERP-DEMO",
            "query_time_ms": random.randint(50, 200),
            "match_algorithm": "exact_match",
        },
    }


def _generate_receipt_data(document_data: dict[str, Any]) -> dict[str, Any]:
    """Generate dummy receipt validation data."""
    return {
        "source": "dummy_json",
        "status": "found",
        "data": {
            "merchant_name": "Demo Store Chain",
            "merchant_id": f"MCH-{random.randint(100, 999)}",
            "transaction_id": f"TXN-{random.randint(10000, 99999)}",
            "total_amount": round(random.uniform(10, 500), 2),
            "transaction_date": "2024-08-20",
            "payment_method": random.choice(["credit_card", "debit_card", "cash"]),
            "merchant_verified": True,
            "location": "Store #123, City Center Mall",
            "currency": "USD",
        },
        "confidence": 0.85,
        "fetch_timestamp": "2024-08-24T10:30:00Z",
        "metadata": {
            "source_system": "POS-DEMO",
            "query_time_ms": random.randint(30, 150),
            "match_algorithm": "fuzzy_match",
        },
    }


def _generate_entry_exit_data(document_data: dict[str, Any]) -> dict[str, Any]:
    """Generate dummy entry/exit log validation data."""
    return {
        "source": "dummy_json",
        "status": "found",
        "data": {
            "employee_id": f"EMP-{random.randint(1000, 9999)}",
            "full_name": "John Doe",
            "department": random.choice(["Engineering", "Sales", "Marketing", "HR"]),
            "access_level": random.choice(["standard", "elevated", "admin"]),
            "badge_active": True,
            "last_entry": "2024-08-20T08:15:00Z",
            "last_exit": "2024-08-20T17:30:00Z",
            "total_hours": 9.25,
            "overtime_eligible": random.choice([True, False]),
        },
        "confidence": 0.95,
        "fetch_timestamp": "2024-08-24T10:30:00Z",
        "metadata": {
            "source_system": "HRMS-DEMO",
            "query_time_ms": random.randint(20, 100),
            "match_algorithm": "employee_id_lookup",
        },
    }


def _generate_generic_data(document_data: dict[str, Any]) -> dict[str, Any]:
    """Generate generic dummy validation data."""
    return {
        "source": "dummy_json",
        "status": "found",
        "data": {
            "reference_id": f"REF-{random.randint(10000, 99999)}",
            "status": random.choice(["active", "inactive", "pending"]),
            "validation_score": round(random.uniform(0.6, 1.0), 2),
            "created_date": "2024-08-20",
            "last_updated": "2024-08-24",
            "tags": random.sample(["verified", "flagged", "reviewed", "approved"], 2),
        },
        "confidence": 0.75,
        "fetch_timestamp": "2024-08-24T10:30:00Z",
        "metadata": {
            "source_system": "GENERIC-DEMO",
            "query_time_ms": random.randint(40, 180),
            "match_algorithm": "content_similarity",
        },
    }
