import sys
from pathlib import Path

# Ensure project root on path for CI environments
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import pytest  # noqa: E402

from mcp.client import start_mcp_server  # noqa: E402
from document_processing.config import get_config  # noqa: E402


def test_server_not_started_when_disabled(monkeypatch):
    config = get_config()
    monkeypatch.setattr(config, "enable_mcp", False)
    with start_mcp_server() as proc:
        assert proc is None


def test_server_starts_when_enabled(monkeypatch):
    config = get_config()
    monkeypatch.setattr(config, "enable_mcp", True)
    monkeypatch.setattr(config, "mcp_server_cmd", "sleep")
    monkeypatch.setattr(config, "mcp_server_args", "5")
    with start_mcp_server() as proc:
        assert proc is not None
        assert proc.poll() is None  # Process is running
    # After context exit process should be terminated
    assert proc.poll() is not None
