import base64

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.main import app
from app.db import engine
from app import models


def test_idempotent_endpoints():
    with TestClient(app) as client:
        content = base64.b64encode(b"id: 1\namount: 50\n").decode()
        resp = client.post(
            "/ingest",
            json={"filename": "a.txt", "mime_type": "text/plain", "base64_content": content},
        )
        doc_id = resp.json()["document_id"]
        payload = client.get(f"/hil/{doc_id}").json()["payload"]
        client.put(f"/hil/{doc_id}", json={"corrected": payload})

        client.post(f"/fetch/{doc_id}", json={})
        client.post(f"/fetch/{doc_id}", json={})

        client.post(f"/reconcile/{doc_id}", json={})
        client.post(f"/reconcile/{doc_id}", json={})

        with Session(engine) as session:
            fetch_jobs = session.exec(
                select(models.FetchJob).where(models.FetchJob.document_id == doc_id)
            ).all()
            assert len(fetch_jobs) == 1
            recs = session.exec(
                select(models.ReconciliationResult).where(
                    models.ReconciliationResult.document_id == doc_id
                )
            ).all()
            assert len(recs) == 1
