from document_processing.doc_extractor import extract_fields


class _FakeResponse:
    def __init__(self, content: str):
        self.content = content


class _FakeModel:
    def __init__(self, payload: dict):
        import json

        self._json = json.dumps(payload)

    def invoke(self, _prompt):
        return _FakeResponse(self._json)


def test_extract_fields_returns_dict():
    model = _FakeModel({"a": 1, "b": 2})
    result = extract_fields("hello", "extract a and b", model=model)
    assert isinstance(result, dict)
    assert result.get("a") == 1

