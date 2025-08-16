from document_processing.pipeline import run_pipeline


def test_pipeline_requires_input():
    try:
        run_pipeline()
        assert False, "Expected ValueError"
    except ValueError:
        pass
