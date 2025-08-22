from __future__ import annotations


def extract_text(content_bytes: bytes) -> str:
    """Placeholder OCR provider."""
    try:
        return content_bytes.decode()
    except Exception:
        return ""
