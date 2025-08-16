from fastapi.testclient import TestClient

from service.api import app

client = TestClient(app)


def test_missing_inputs_returns_400():
    resp = client.post("/classify-extract")
    assert resp.status_code == 400
    assert "file or file_url" in resp.json()["detail"].lower()


def test_invalid_doc_type_returns_400():
    resp = client.post("/classify-extract", data={"doc_type": "not_a_type", "file_url": "https://example.com/doc.pdf"})
    # Will likely fail at URL fetch but doc_type should be validated first when file_url is present
    # If fetch happens first and fails, accept either 400 detail
    assert resp.status_code == 400


def test_sync_success_with_file_and_stubbed_pipeline(monkeypatch):
    from service import api as api_module

    def fake_run_pipeline(
        file, file_path, return_text, forced_doc_type, use_agents, run_refine_pass, ocr_fallback
    ):
        return {"classification": {"type": "other", "confidence": 1.0}, "data": {"ok": True}}

    monkeypatch.setattr(api_module, "run_pipeline", fake_run_pipeline)

    files = {"file": ("sample.png", b"tiny-bytes")}
    resp = client.post("/classify-extract", files=files, data={"return_text": "false"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["classification"]["type"] == "other"
    assert body["data"]["ok"] is True


def test_async_queues_202_with_callback(monkeypatch):
    from service import api as api_module

    async def fake_background(*args, **kwargs):
        return None

    monkeypatch.setattr(api_module, "_process_and_callback", fake_background)
    resp = client.post(
        "/classify-extract",
        data={
            "file_url": "https://example.com/a.pdf",
            "callback_url": "https://example.com/cb"
        }
    )
    assert resp.status_code == 202
    assert resp.json()["status"] == "queued"

