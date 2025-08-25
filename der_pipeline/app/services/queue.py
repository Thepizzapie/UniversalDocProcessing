"""Queue service interface and in-process implementation."""

from abc import ABC, abstractmethod
from typing import Any


class QueueServiceInterface(ABC):
    """Interface for queue operations."""

    @abstractmethod
    async def enqueue(self, task_name: str, payload: dict[str, Any]) -> str:
        """Enqueue a task for background processing."""
        pass


class InProcessQueueService(QueueServiceInterface):
    """In-process queue implementation using FastAPI BackgroundTasks."""

    def __init__(self):
        self.background_tasks: dict[str, Any] = {}

    async def enqueue(self, task_name: str, payload: dict[str, Any]) -> str:
        """Enqueue a task (currently just logs it - extend for real background processing)."""
        task_id = f"{task_name}_{id(payload)}"

        # In a real implementation, you would:
        # 1. Store task in database/queue
        # 2. Start background worker
        # 3. Return task ID for tracking

        print(f"ENQUEUED TASK: {task_name} with payload: {payload}")

        # For now, just store in memory
        self.background_tasks[task_id] = {
            "task_name": task_name,
            "payload": payload,
            "status": "QUEUED",
        }

        return task_id


# Global queue service instance
queue_service = InProcessQueueService()


async def enqueue_task(task_name: str, payload: dict[str, Any]) -> str:
    """Convenience function to enqueue tasks."""
    return await queue_service.enqueue(task_name, payload)
