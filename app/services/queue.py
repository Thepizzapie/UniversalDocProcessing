from __future__ import annotations

from typing import Callable, Dict

from fastapi import BackgroundTasks


class QueueInterface:
    def enqueue(self, task_name: str, payload: dict) -> None:  # pragma: no cover - interface
        raise NotImplementedError


class InProcessQueue(QueueInterface):
    def __init__(self, background: BackgroundTasks, registry: Dict[str, Callable]):
        self.background = background
        self.registry = registry

    def enqueue(self, task_name: str, payload: dict) -> None:
        handler = self.registry[task_name]
        self.background.add_task(handler, **payload)
