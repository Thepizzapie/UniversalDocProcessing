"""Base external API adapter with common functionality."""

from abc import ABC, abstractmethod
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from ...config import settings
from ...models import Document
from ...schemas import FetchedRecord


class ExternalApiAdapterInterface(ABC):
    """Interface for external API adapters."""

    @abstractmethod
    async def fetch(self, document: Document) -> FetchedRecord:
        """Fetch data from external source."""
        pass


class BaseExternalApiAdapter(ExternalApiAdapterInterface):
    """Base adapter with common HTTP functionality."""

    def __init__(self, base_url: str, api_key: str = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.client = None

    async def __aenter__(self):
        """Async context manager entry."""
        self.client = httpx.AsyncClient(
            timeout=settings.external_timeout_seconds, headers=self._get_headers()
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.client:
            await self.client.aclose()

    def _get_headers(self) -> dict[str, str]:
        """Get HTTP headers for requests."""
        headers = {
            "User-Agent": "UniversalDocProcessing/1.0",
            "Accept": "application/json",
        }

        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        return headers

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def _make_request(self, method: str, endpoint: str, **kwargs) -> dict[str, Any]:
        """Make HTTP request with retry logic."""
        if not self.client:
            raise RuntimeError("Client not initialized. Use async context manager.")

        url = f"{self.base_url}{endpoint}"

        try:
            response = await self.client.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            # Log error and re-raise
            print(f"HTTP error for {url}: {e}")
            raise

    async def fetch(self, document: Document) -> FetchedRecord:
        """Default fetch implementation - override in subclasses."""
        return FetchedRecord(source=self.__class__.__name__, payload={"error": "Not implemented"})


def get_external_api_adapter(target: str) -> ExternalApiAdapterInterface:
    """Factory function to get external API adapter by target name."""

    # Import adapters here to avoid circular imports
    from .example_vendor import ExampleVendorAdapter

    adapters = {
        "example_vendor": ExampleVendorAdapter(),
        "erp": ExampleVendorAdapter(),  # Placeholder
        "accounting_system": ExampleVendorAdapter(),  # Placeholder
    }

    return adapters.get(target)
