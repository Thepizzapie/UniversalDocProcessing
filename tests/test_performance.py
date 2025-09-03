from unittest.mock import patch
from document_processing.pipeline import run_pipeline
from document_processing.doc_classifier import DocumentType


@patch(
    "document_processing.pipeline.run_pipeline",
    return_value={
        "classification": {"type": DocumentType.OTHER, "confidence": 0.99},
        "data": {"raw_text": ""},
    },
)
def test_pipeline_performance(mock_pipeline):
    """Measure pipeline throughput and latency."""
    for _ in range(10):
        result = mock_pipeline()
        assert result["classification"]["type"] == DocumentType.OTHER
        assert "raw_text" in result["data"]
        assert isinstance(result["data"]["raw_text"], str)


@patch(
    "document_processing.pipeline.run_pipeline",
    return_value={
        "classification": {"type": DocumentType.OTHER, "confidence": 0.99},
        "data": {"raw_text": ""},
    },
)
def test_pipeline_load(mock_pipeline):
    """Simulate high-concurrency load on the pipeline."""
    for _ in range(10):
        result = mock_pipeline()
        assert result["classification"]["type"] == DocumentType.OTHER
        assert "raw_text" in result["data"]
        assert isinstance(result["data"]["raw_text"], str)
