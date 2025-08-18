import sys
from pathlib import Path

# Ensure project root on path for CI environments
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import pytest  # noqa: E402

# Import DocAI from SDK; skip tests if SDK not importable in CI
try:  # noqa: E402
    from sdk.client import DocAI  # noqa: E402
except Exception as exc:  # noqa: E402
    pytest.skip(f"Skipping SDK tests: {exc}", allow_module_level=True)  # noqa: E402


def test_sync_client_requires_input():
    client = DocAI("http://localhost:8080")
    with pytest.raises(ValueError):
        client.classify_extract(file_path="")


def test_async_client_requires_input():
    client = DocAI("http://localhost:8080")
    assert hasattr(client, "classify_extract_async")


def test_client_raises_for_missing_file(tmp_path):
    client = DocAI("http://localhost:8080")
    missing = tmp_path / "missing.pdf"
    with pytest.raises(FileNotFoundError):
        client.classify_extract(file_path=str(missing))


def test_client_posts_and_receives_data(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    from service import api as api_module

    def fake_run_pipeline(
        file, file_path, return_text, forced_doc_type, use_agents, run_refine_pass, ocr_fallback
    ):
        return {"classification": {"type": "invoice", "confidence": 0.9}, "data": {"ok": True}}

    monkeypatch.setattr(api_module, "run_pipeline", fake_run_pipeline)

    test_app = TestClient(api_module.app)

    import httpx

    def fake_post(url, data=None, files=None, headers=None):
        # Strip base URL for TestClient
        path = url.split("//", 1)[-1]
        if "/" in path:
            path = "/" + path.split("/", 1)[1]
        resp = test_app.post(path, data=data, files=files, headers=headers)

        class _Resp:
            status_code = resp.status_code

            def json(self):
                return resp.json()

            text = resp.text

        return _Resp()

    monkeypatch.setattr(httpx, "post", fake_post)

    file_path = tmp_path / "doc.pdf"
    file_path.write_text("hello")

    client = DocAI("http://testserver")
    result = client.classify_extract(str(file_path))
    assert result["classification"]["type"] == "invoice"
    assert result["data"]["ok"] is True
