from document_processing.doc_classifier import classify_document, DocumentType, ClassificationResult


class _FakeResponse:
    def __init__(self, content: str):
        self.content = content


class _FakeModel:
    def __init__(self, payload: dict):
        import json

        self._json = json.dumps(payload)

    def invoke(self, _prompt):
        return _FakeResponse(self._json)


def test_classify_document_parses_json():
    model = _FakeModel({"type": "invoice", "confidence": 0.9})
    result: ClassificationResult = classify_document("some text", model=model)
    assert result.type == DocumentType.INVOICE
    assert 0.0 <= result.confidence <= 1.0


def test_classify_document_fallback_on_bad_json():
    class _BadModel:
        def invoke(self, _prompt):
            return _FakeResponse("not json")

    result = classify_document("text", model=_BadModel())
    assert result.type == DocumentType.OTHER
    assert result.confidence == 0.0

