import os
from unittest.mock import patch
from document_processing.agents import extract_with_agent


@patch("document_processing.agents.lc_extract_fields", return_value={"mock_key": "mock_value"})
def test_agents_without_mcp(mock_extract):
    """Test agents run independently when MCP is disabled."""
    os.environ["ENABLE_MCP"] = "false"
    result = extract_with_agent("Sample text", "Sample instructions")
    assert result == {"mock_key": "mock_value"}


@patch("document_processing.agents.lc_extract_fields", return_value={"mock_key": "mock_value"})
def test_agents_with_mcp(mock_extract):
    """Test agents use MCP when enabled."""
    os.environ["ENABLE_MCP"] = "true"
    os.environ["MCP_SERVER_CMD"] = "mock_mcp_server"
    os.environ["MCP_SERVER_ARGS"] = "--mock-args"
    result = extract_with_agent("Sample text", "Sample instructions")
    assert result == {"mock_key": "mock_value"}
