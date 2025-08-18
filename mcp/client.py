from __future__ import annotations

import logging
import shlex
import subprocess
from contextlib import contextmanager
from typing import Iterator, Optional

from document_processing.config import get_config

logger = logging.getLogger(__name__)


@contextmanager
def start_mcp_server() -> Iterator[Optional[subprocess.Popen]]:
    """Start the configured MCP server if enabled.

    Returns an active ``Popen`` handle while the context is open. The process is
    terminated when the context exits. If MCP integration is disabled or the
    command is missing, ``None`` is yielded instead.
    """

    config = get_config()
    if not getattr(config, "enable_mcp", False):
        yield None
        return

    cmd = getattr(config, "mcp_server_cmd", "")
    if not cmd:
        logger.warning("ENABLE_MCP is true but MCP_SERVER_CMD is not set")
        yield None
        return

    args = shlex.split(getattr(config, "mcp_server_args", ""))
    full_cmd = [cmd, *args]
    logger.info("Starting MCP server: %s", " ".join(full_cmd))
    proc = subprocess.Popen(full_cmd)
    try:
        yield proc
    finally:
        logger.info("Stopping MCP server")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
