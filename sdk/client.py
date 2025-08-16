"""
Python SDK for the Document AI Service.

This module provides a thin wrapper around the HTTP API exposed by the
FastAPI service in ``service/api.py``.  It allows your Python code to
upload documents, trigger classification/extraction and receive the
structured results without dealing with HTTP details.  The client
supports synchronous operation only; for asynchronous integration see the
callback mechanism in the service API.

Example usage:

    from sdk.client import DocAI
    client = DocAI("http://localhost:8080")
    result = client.classify_extract(file_path="/path/to/invoice.pdf")
    print(result)

You may also specify ``file_url`` instead of ``file_path``.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
import requests

__all__ = ["DocAI"]


class DocAI:
    """Client for interacting with the Document AI Service via HTTP."""

    def __init__(self, base_url: str, token: Optional[str] = None) -> None:
        """Create a new client.

        Args:
            base_url: Base URL of the service (e.g., ``http://localhost:8080``).
            token: Optional bearer token for authorization.  If provided
                the token will be sent in the ``Authorization`` header as
                ``Bearer <token>``.
        """
        self.base_url = base_url.rstrip("/")
        self.token = token

    def classify_extract(
        self,
        file_path: Optional[str] = None,
        file_url: Optional[str] = None,
        callback_url: Optional[str] = None,
        return_text: bool = False,
        doc_type: Optional[str] = None,
        use_agents: bool = True,
        refine: bool = True,
        ocr_fallback: bool = True,
    ) -> Dict[str, Any]:
        """Submit a document for classification and extraction.

        Either ``file_path`` or ``file_url`` must be provided.  If
        ``callback_url`` is provided, the service will process the
        document asynchronously; this client does not wait for the
        callback to be delivered and instead returns the 202 response
        immediately.

        Args:
            file_path: Path to a document on disk.
            file_url: URL pointing to a document.
            callback_url: Optional callback URL for asynchronous
                processing.
            return_text: Whether to include the raw OCR text in the
                response.

        Returns:
            A dictionary containing the JSON response from the service.
        """
        if not file_path and not file_url:
            raise ValueError("Either 'file_path' or 'file_url' must be provided")

        url = f"{self.base_url}/classify-extract"
        headers: Dict[str, str] = {"Idempotency-Key": str(uuid.uuid4())}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        data: Dict[str, str] = {}
        files: Dict[str, Any] = {}

        if file_url:
            data["file_url"] = file_url
        if callback_url:
            data["callback_url"] = callback_url
        data["return_text"] = "true" if return_text else "false"
        if doc_type:
            data["doc_type"] = doc_type
        data["use_agents"] = "true" if use_agents else "false"
        data["refine"] = "true" if refine else "false"
        data["ocr_fallback"] = "true" if ocr_fallback else "false"

        if file_path:
            # Ensure path exists and open file
            path = Path(file_path)
            if not path.exists():
                raise FileNotFoundError(file_path)
            files["file"] = open(path, "rb")

        response = requests.post(url, headers=headers, data=data, files=files)
        # Close the file handle if opened
        if files:
            files["file"].close()
        try:
            response.raise_for_status()
        except requests.HTTPError as e:
            try:
                err_json = response.json()
            except Exception:
                err_json = {"detail": response.text}
            raise requests.HTTPError(f"{e} - {json.dumps(err_json)}") from e
        return response.json()

    async def classify_extract_async(
        self,
        file_path: Optional[str] = None,
        file_url: Optional[str] = None,
        callback_url: Optional[str] = None,
        return_text: bool = False,
        doc_type: Optional[str] = None,
        use_agents: bool = True,
        refine: bool = True,
        ocr_fallback: bool = True,
    ) -> Dict[str, Any]:
        """Async variant of classify_extract using httpx.AsyncClient."""
        if not file_path and not file_url:
            raise ValueError("Either 'file_path' or 'file_url' must be provided")

        url = f"{self.base_url}/classify-extract"
        headers: Dict[str, str] = {"Idempotency-Key": str(uuid.uuid4())}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        data: Dict[str, str] = {}
        files: Dict[str, Any] = {}

        if file_url:
            data["file_url"] = file_url
        if callback_url:
            data["callback_url"] = callback_url
        data["return_text"] = "true" if return_text else "false"
        if doc_type:
            data["doc_type"] = doc_type
        data["use_agents"] = "true" if use_agents else "false"
        data["refine"] = "true" if refine else "false"
        data["ocr_fallback"] = "true" if ocr_fallback else "false"

        file_handle = None
        try:
            if file_path:
                path = Path(file_path)
                if not path.exists():
                    raise FileNotFoundError(file_path)
                file_handle = open(path, "rb")
                files = {"file": (path.name, file_handle, "application/octet-stream")}

            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, data=data, files=files)
                try:
                    response.raise_for_status()
                except httpx.HTTPStatusError as e:
                    try:
                        err_json = response.json()
                    except Exception:
                        err_json = {"detail": response.text}
                    raise httpx.HTTPStatusError(
                        f"{e} - {json.dumps(err_json)}", request=e.request, response=e.response
                    )
                return response.json()
        finally:
            if file_handle:
                file_handle.close()
