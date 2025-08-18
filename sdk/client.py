from __future__ import annotations

import httpx
from pathlib import Path
from typing import Any, Dict, Optional


class DocAI:
    """Simple SDK client for the Document AI service."""

    def __init__(self, base_url: str, token: Optional[str] = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token

    def _headers(self) -> Dict[str, str]:
        headers: Dict[str, str] = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def classify_extract(
        self,
        file_path: str,
        doc_type: Optional[str] = None,
        use_agents: bool = True,
        refine: bool = True,
    ) -> Dict[str, Any]:
        """Upload a document for classification and extraction."""
        if not file_path:
            raise ValueError("file_path is required")

        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        data = {
            "use_agents": str(use_agents).lower(),
            "refine": str(refine).lower(),
        }
        if doc_type:
            data["doc_type"] = doc_type

        with path.open("rb") as f:
            files = {"file": (path.name, f)}
            resp = httpx.post(
                f"{self.base_url}/classify-extract",
                data=data,
                files=files,
                headers=self._headers(),
            )

        if resp.status_code >= 400:
            raise RuntimeError(f"API request failed: {resp.text}")
        return resp.json()

    async def classify_extract_async(
        self,
        file_path: str,
        doc_type: Optional[str] = None,
        use_agents: bool = True,
        refine: bool = True,
    ) -> Dict[str, Any]:
        """Async version of :meth:`classify_extract`."""
        if not file_path:
            raise ValueError("file_path is required")

        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        data = {
            "use_agents": str(use_agents).lower(),
            "refine": str(refine).lower(),
        }
        if doc_type:
            data["doc_type"] = doc_type

        async with httpx.AsyncClient(base_url=self.base_url, headers=self._headers()) as client:
            with path.open("rb") as f:
                files = {"file": (path.name, f)}
                resp = await client.post("/classify-extract", data=data, files=files)

        if resp.status_code >= 400:
            raise RuntimeError(f"API request failed: {resp.text}")
        return resp.json()
