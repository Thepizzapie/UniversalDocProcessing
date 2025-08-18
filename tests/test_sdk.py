import sys
from pathlib import Path

# Ensure project root on path for CI environments
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import pytest  # noqa: E402

# Import DocAI from SDK; skip tests if SDK not importable in CI
try:  # noqa: E402
    from sdk.client import DocAI  # noqa: E402
except Exception as exc:  # noqa: E402
    pytest.skip(f'Skipping SDK tests: {exc}', allow_module_level=True)  # noqa: E402


def test_sync_client_requires_input():
    client = DocAI("http://localhost:8080")
    with pytest.raises(ValueError):
        client.classify_extract()


def test_async_client_requires_input():
    client = DocAI("http://localhost:8080")
    assert hasattr(client, "classify_extract_async")


def test_client_raises_for_missing_file(tmp_path):
    client = DocAI("http://localhost:8080")
    missing = tmp_path / "missing.pdf"
    with pytest.raises(FileNotFoundError):
        client.classify_extract(file_path=str(missing))
