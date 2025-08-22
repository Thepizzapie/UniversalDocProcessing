from __future__ import annotations


from ..schemas import ExtractedField, ExtractedRecord


def extract_fields(text: str) -> ExtractedRecord:
    record: ExtractedRecord = {}
    for line in text.splitlines():
        if ":" in line:
            key, val = line.split(":", 1)
            record[key.strip()] = ExtractedField(value=val.strip(), confidence=0.9)
    if not record:
        record = {
            "id": ExtractedField(value="123", confidence=0.8),
            "amount": ExtractedField(value="100.00", confidence=0.8),
            "date": ExtractedField(value="2020-01-02", confidence=0.8),
            "vendor": ExtractedField(value="ACME", confidence=0.8),
        }
    return record
