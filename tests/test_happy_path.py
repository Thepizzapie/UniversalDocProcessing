import base64

from fastapi.testclient import TestClient

from app.main import app


def test_happy_path():
    with TestClient(app) as client:
        content = base64.b64encode(
            b"id: 123\namount: 100.00\ndate: 2020-01-02\nvendor: ACME"
        ).decode()
        resp = client.post(
            "/ingest",
            json={"filename": "doc.txt", "mime_type": "text/plain", "base64_content": content},
        )
        data = resp.json()
        doc_id = data["document_id"]
        assert data["state"] == "HIL_REQUIRED"

        resp = client.get(f"/hil/{doc_id}")
        payload = resp.json()["payload"]

        resp = client.put(f"/hil/{doc_id}", json={"corrected": payload})
        assert resp.json()["state"] == "FETCH_PENDING"

        resp = client.post(f"/fetch/{doc_id}", json={})
        assert resp.json()["state"] == "FETCHED"

        resp = client.post(f"/reconcile/{doc_id}", json={"strategy": "loose"})
        assert resp.json()["state"] == "FINAL_REVIEW"
        assert resp.json()["score_overall"] == 1.0

        resp = client.post(f"/finalize/{doc_id}", json={"decision": "APPROVED"})
        assert resp.json()["state"] == "APPROVED"

        report = client.get(f"/reports/{doc_id}").json()
        assert report["decision"] == "APPROVED"
        assert len(report["audit"]) >= 5
