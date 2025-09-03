"""Lightweight field extraction helpers."""

from __future__ import annotations

import json
from typing import Any, Dict


def extract_fields(text: str, instructions: str, model: object | None = None) -> Dict[str, Any]:
    """Extract structured data from ``text`` using ``instructions``.

    The function expects ``model`` to expose an ``invoke`` method returning an
    object with a ``content`` attribute containing JSON.  This mirrors the
    behaviour of more sophisticated LLM wrappers while remaining trivial for
    tests.
    """
    if model is None:
        return {}

    response = model.invoke(f"{instructions}\n{text}")
    try:
        return json.loads(response.content)
    except Exception:
        return {}


def extract_fields_from_image(image_bytes: bytes, instructions: str, model: object | None = None) -> Dict[str, Any]:
    """Placeholder image extractor.

    A real implementation would perform OCR before delegating to
    :func:`extract_fields`.  For the purposes of the MVP and unit tests we
    simply ignore the image and return an empty result or delegate directly if a
    ``model`` is provided.
    """
    del image_bytes  # unused
    return extract_fields("", instructions, model=model)
