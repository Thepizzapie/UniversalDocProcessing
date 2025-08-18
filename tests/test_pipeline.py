from document_processing.pipeline import run_pipeline


def test_pipeline_requires_input():
    try:
        run_pipeline()
        assert False, "Expected ValueError"
    except ValueError:
        pass


def test_pipeline_includes_errors_on_failures(monkeypatch, tmp_path):
    # Force vision extraction to raise and ensure errors array appears
    from document_processing import pipeline as pipeline_module

    def bad_extract(*args, **kwargs):
        raise RuntimeError("boom")

    # Mock the vision extraction used in AI-only pipeline
    monkeypatch.setattr(pipeline_module, "extract_fields_from_image", bad_extract)
    sample = tmp_path / "a.png"
    sample.write_bytes(b"fake")
    result = run_pipeline(file_path=str(sample), ocr_fallback=True)
    assert "errors" in result
