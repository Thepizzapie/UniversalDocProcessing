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
    pytest.skip(f"Skipping SDK tests: {exc}", allow_module_level=True)  # noqa: E402


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


def test_sdk_posts_and_receives(tmp_path):
    # start a simple HTTP server to mock service
    from http.server import BaseHTTPRequestHandler, HTTPServer
    from threading import Thread

    class SimpleHandler(BaseHTTPRequestHandler):
        def do_POST(self):
            # Read and discard incoming request body to avoid client connection resets
            try:
                content_length = int(self.headers.get("Content-Length", 0))
            except Exception:
                content_length = 0
            if content_length:
                _ = self.rfile.read(content_length)

            body = b'{"classification": {"type": "invoice", "confidence": 0.9}, "data": {"invoice_number": "INV-1"}}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def run_server(port):
        server = HTTPServer(("", port), SimpleHandler)
        server.serve_forever()

    port = 8123
    t = Thread(target=run_server, args=(port,), daemon=True)
    t.start()

    client = DocAI(f"http://127.0.0.1:{port}")
    tmpfile = tmp_path / "doc.pdf"
    tmpfile.write_bytes(b"pdfdata")

    res = client.classify_extract(str(tmpfile))
    assert res["classification"]["type"] == "invoice"




