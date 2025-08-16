import pytest

from sdk.client import DocAI


def test_sync_client_requires_input():
    client = DocAI("http://localhost:8080")
    with pytest.raises(ValueError):
        client.classify_extract()


@pytest.mark.asyncio
async def test_async_client_requires_input():
    client = DocAI("http://localhost:8080")
    with pytest.raises(ValueError):
        await client.classify_extract_async()

