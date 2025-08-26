"""Celery application for async task processing."""

from celery import Celery

from app.config import settings

# Create Celery app
celery_app = Celery(
    "udoc_tasks",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["der_pipeline.tasks"],
)

# Configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_routes={
        "tasks.fetch_target": {"queue": "fetch"},
        "tasks.ocr_document": {"queue": "ocr"},
        "tasks.reconcile_document": {"queue": "reconcile"},
    },
)

if __name__ == "__main__":
    celery_app.start()

