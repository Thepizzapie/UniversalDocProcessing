"""Simple SDK client for the Document AI FastAPI service.

Provides synchronous and asynchronous helpers to call the `/classify-extract`
endpoint. Uses httpx for requests.
"""

from __future__ import annotations

from typing import Optional, Dict, Any
import httpx
import os


class DocAI:
    def __init__(self, base_url: str, token: Optional[str] = None, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout

    def _headers(self) -> Dict[str, str]:
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def classify_extract(
        self,
        file_path: Optional[str] = None,
        doc_type: Optional[str] = None,
        use_agents: bool = True,
        refine: bool = True,
    ) -> Dict[str, Any]:
        if not file_path:
            raise ValueError("file_path is required")
        if not os.path.exists(file_path):
            raise FileNotFoundError(file_path)
        url = f"{self.base_url}/classify-extract"

        files = {"file": open(file_path, "rb")}
        data = {
            "use_agents": str(use_agents).lower(),
            "refine": str(refine).lower(),
        }
        if doc_type:
            data["doc_type"] = doc_type

        try:
            with httpx.Client(timeout=self.timeout, headers=self._headers()) as client:
                r = client.post(url, files=files, data=data)
                r.raise_for_status()
                return r.json()
        except Exception as e:
            raise RuntimeError(f"SDK request failed: {e}")
        finally:
            try:
                files["file"].close()
            except Exception:
                pass

    async def classify_extract_async(
        self,
        file_path: Optional[str] = None,
        doc_type: Optional[str] = None,
        use_agents: bool = True,
        refine: bool = True,
    ) -> Dict[str, Any]:
        if not file_path:
            raise ValueError("file_path is required")
        if not os.path.exists(file_path):
            raise FileNotFoundError(file_path)
        url = f"{self.base_url}/classify-extract"
        data = {
            "use_agents": str(use_agents).lower(),
            "refine": str(refine).lower(),
        }
        if doc_type:
            data["doc_type"] = doc_type

        headers = self._headers()

        async with httpx.AsyncClient(timeout=self.timeout, headers=headers) as client:
            try:
                with open(file_path, "rb") as f:
                    files = {"file": (file_path, f)}
                    r = await client.post(url, files=files, data=data)
                    r.raise_for_status()
                    return r.json()
            except Exception as e:
                raise RuntimeError(f"SDK async request failed: {e}")
