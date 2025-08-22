from __future__ import annotations

from typing import Dict

from ...schemas import FetchedRecord


def _value(v):
    if isinstance(v, dict) and "value" in v:
        return v["value"]
    return v


def fetch(document, corrected: Dict) -> FetchedRecord:
    payload = {
        "id": _value(corrected.get("id", "123")),
        "amount": _value(corrected.get("amount", "100.00")),
        "date": _value(corrected.get("date", "2020-01-01")),
        "vendor": _value(corrected.get("vendor", "ACME")),
    }
    return {"source": "example_vendor", "payload": payload}
