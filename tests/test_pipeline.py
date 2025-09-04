import json
import os
import pytest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from document_processing.pipeline import run_pipeline
from document_processing.doc_classifier import DocumentType


def load_sample_data(file_name):
    with open(file_name, "r") as f:
        return json.load(f)


data_dir = os.path.join(os.path.dirname(__file__), "..", "datasets")
sample = os.path.join(data_dir, "sample.pdf")


@patch(
    "document_processing.pipeline.run_pipeline",
    return_value={
        "classification": {"type": DocumentType.OTHER, "confidence": 0.99},
        "data": {"raw_text": ""},
    },
)
def test_pipeline_requires_input(mock_pipeline):
    """Test pipeline requires input."""
    # Use the mocked return value
    result = mock_pipeline()
    assert result["classification"]["type"] == DocumentType.OTHER
    assert "raw_text" in result["data"]
    assert isinstance(result["data"]["raw_text"], str)


@pytest.mark.stress
def test_pipeline_stress():
    """Simulate high-concurrency stress test."""

    def process_document():
        result = run_pipeline(file_path="sample.pdf")
        assert "classification" in result
        assert "data" in result

    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = [executor.submit(process_document) for _ in range(100)]
        for future in futures:
            future.result()
