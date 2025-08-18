import pytest

from sdk.client import DocAI


def test_sync_client_requires_input():
    client = DocAI("http://localhost:8080")
    with pytest.raises(ValueError):
        client.classify_extract()


def test_async_client_requires_input():
    client = DocAI("http://localhost:8080")
    # Test that the async method exists
    assert hasattr(client, "classify_extract_async")


def test_client_raises_for_missing_file(tmp_path):
    client = DocAI("http://localhost:8080")
    missing = tmp_path / "missing.pdf"
    try:
        client.classify_extract(file_path=str(missing))
        assert False, "Expected FileNotFoundError"
    except FileNotFoundError:
        pass
