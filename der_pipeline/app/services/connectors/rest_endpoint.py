"""REST endpoint connector for fetching external data."""

from typing import Any

import httpx
from loguru import logger

from ...config import settings


async def fetch_data(
    endpoint_url: str, document_data: dict[str, Any], headers: dict[str, str] | None = None
) -> dict[str, Any]:
    """Fetch data from a REST endpoint.

    Args:
        endpoint_url: The REST endpoint URL
        document_data: Document data to include in request
        headers: Optional headers for the request

    Returns:
        Response data from the endpoint
    """

    default_headers = {
        "Content-Type": "application/json",
        "User-Agent": "UniversalDocProcessing/1.0",
    }

    if headers:
        default_headers.update(headers)

    try:
        async with httpx.AsyncClient(timeout=settings.external_timeout_seconds) as client:
            # Try POST request with document data
            logger.info(f"Fetching data from REST endpoint: {endpoint_url}")

            response = await client.post(
                endpoint_url,
                json={
                    "document_data": document_data,
                    "request_type": "document_validation",
                    "timestamp": "2024-08-24T10:30:00Z",
                },
                headers=default_headers,
            )

            response.raise_for_status()
            result = response.json()

            return {
                "source": "rest_endpoint",
                "status": "success",
                "data": result,
                "response_code": response.status_code,
                "fetch_timestamp": "2024-08-24T10:30:00Z",
                "metadata": {
                    "endpoint_url": endpoint_url,
                    "response_time_ms": response.elapsed.total_seconds() * 1000,
                    "response_headers": dict(response.headers),
                },
            }

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error fetching from {endpoint_url}: {e}")
        return {
            "source": "rest_endpoint",
            "status": "error",
            "error": f"HTTP {e.response.status_code}: {e.response.text}",
            "fetch_timestamp": "2024-08-24T10:30:00Z",
        }

    except httpx.TimeoutException:
        logger.error(f"Timeout fetching from {endpoint_url}")
        return {
            "source": "rest_endpoint",
            "status": "timeout",
            "error": f"Request timeout after {settings.external_timeout_seconds}s",
            "fetch_timestamp": "2024-08-24T10:30:00Z",
        }

    except Exception as e:
        logger.error(f"Error fetching from {endpoint_url}: {e}")
        return {
            "source": "rest_endpoint",
            "status": "error",
            "error": str(e),
            "fetch_timestamp": "2024-08-24T10:30:00Z",
        }


def fetch_data_sync(
    endpoint_url: str, document_data: dict[str, Any], headers: dict[str, str] | None = None
) -> dict[str, Any]:
    """Synchronous version of fetch_data using requests."""

    import requests

    default_headers = {
        "Content-Type": "application/json",
        "User-Agent": "UniversalDocProcessing/1.0",
    }

    if headers:
        default_headers.update(headers)

    try:
        logger.info(f"Fetching data from REST endpoint: {endpoint_url}")

        response = requests.post(
            endpoint_url,
            json={
                "document_data": document_data,
                "request_type": "document_validation",
                "timestamp": "2024-08-24T10:30:00Z",
            },
            headers=default_headers,
            timeout=settings.external_timeout_seconds,
        )

        response.raise_for_status()
        result = response.json()

        return {
            "source": "rest_endpoint",
            "status": "success",
            "data": result,
            "response_code": response.status_code,
            "fetch_timestamp": "2024-08-24T10:30:00Z",
            "metadata": {
                "endpoint_url": endpoint_url,
                "response_time_ms": response.elapsed.total_seconds() * 1000,
                "response_headers": dict(response.headers),
            },
        }

    except requests.HTTPError as e:
        logger.error(f"HTTP error fetching from {endpoint_url}: {e}")
        return {
            "source": "rest_endpoint",
            "status": "error",
            "error": f"HTTP {e.response.status_code}: {e.response.text}" if e.response else str(e),
            "fetch_timestamp": "2024-08-24T10:30:00Z",
        }

    except requests.Timeout:
        logger.error(f"Timeout fetching from {endpoint_url}")
        return {
            "source": "rest_endpoint",
            "status": "timeout",
            "error": f"Request timeout after {settings.external_timeout_seconds}s",
            "fetch_timestamp": "2024-08-24T10:30:00Z",
        }

    except Exception as e:
        logger.error(f"Error fetching from {endpoint_url}: {e}")
        return {
            "source": "rest_endpoint",
            "status": "error",
            "error": str(e),
            "fetch_timestamp": "2024-08-24T10:30:00Z",
        }
