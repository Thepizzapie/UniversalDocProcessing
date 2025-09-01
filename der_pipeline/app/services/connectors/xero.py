"""Xero connector stub."""
from __future__ import annotations

from typing import Any


def fetch_data(config: dict[str, Any], document_data: dict[str, Any]) -> dict[str, Any]:
    return {
        "source": "xero",
        "status": "success",
        "data": {
            "matched_contact": document_data.get("filename", "contact"),
            "recent_invoices": 3,
            "currency": "USD",
        },
    }
