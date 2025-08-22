from __future__ import annotations

import httpx
from tenacity import retry, stop_after_attempt, wait_fixed

from ...config import settings


@retry(stop=stop_after_attempt(3), wait=wait_fixed(1))
def get_client() -> httpx.Client:
    return httpx.Client(timeout=settings.external_timeout_seconds)
