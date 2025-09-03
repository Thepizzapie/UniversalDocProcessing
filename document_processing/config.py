"""Configuration helpers for the MVP backend.

Only a handful of settings are required.  The object is intentionally small
but can grow as the project evolves.  The :func:`validate_config` function
mirrors the behaviour of the original code, returning ``True`` when the
configuration is considered valid.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Dict, Set


@dataclass
class Config:
    """Runtime configuration loaded from environment variables."""

    openai_api_key: str | None = os.environ.get("OPENAI_API_KEY")
    model_name: str = os.environ.get("MODEL_NAME", "gpt-4o-mini")
    enable_mcp: bool = os.environ.get("ENABLE_MCP", "true").lower() in {"1", "true", "yes"}
    allowed_tokens: Set[str] = field(
        default_factory=lambda: {
            t.strip() for t in os.environ.get("ALLOWED_TOKENS", "").split(",") if t.strip()
        }
    )

    def validate(self) -> Dict[str, object]:
        """Validate configuration values and return a summary."""
        errors: list[str] = []
        if not self.openai_api_key:
            errors.append("OPENAI_API_KEY is not set")
        return {"valid": not errors, "errors": errors, "warnings": []}


config = Config()


def get_config() -> Config:
    """Return the global :class:`Config` instance."""

    return config


def validate_config() -> bool:
    """Validate and return ``True`` if configuration is acceptable."""

    return config.validate()["valid"]
