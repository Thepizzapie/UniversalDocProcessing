"""SFTP connector stub for fetching reference CSV/JSON files."""
from __future__ import annotations

from typing import Any


def fetch_data(config: dict[str, Any], document_data: dict[str, Any]) -> dict[str, Any]:
    path = config.get("path", "/data/reference.csv")
    return {
        "source": "sftp",
        "status": "success",
        "data": {
            "path": path,
            "records": 42,
            "sample": {"key": "value"},
        },
    }
