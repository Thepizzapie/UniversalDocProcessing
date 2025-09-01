"""QuickBooks Online connector stub."""
from __future__ import annotations

from typing import Any


def fetch_data(config: dict[str, Any], document_data: dict[str, Any]) -> dict[str, Any]:
    return {
        "source": "quickbooks",
        "status": "success",
        "data": {
            "matched_vendor": document_data.get("filename", "vendor"),
            "open_bills": 2,
            "avg_payment_days": 28,
        },
    }
