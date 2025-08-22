from app.utils import diff


def test_strict_loose_fuzzy():
    extracted = {
        "amount": {"value": "100.00"},
        "date": {"value": "2020-01-02"},
        "vendor": {"value": "Acme, Inc."},
    }
    fetched = {"amount": "100", "date": "2020-01-01", "vendor": "acme inc"}
    diffs_strict, _ = diff.reconcile_records(extracted, fetched, strategy="strict")
    assert any(d["status"] == "MISMATCH" for d in diffs_strict)

    diffs_loose, score_loose = diff.reconcile_records(extracted, fetched, strategy="loose")
    status_map = {d["field"]: d["status"] for d in diffs_loose}
    assert status_map["amount"] == "MATCH"
    assert status_map["date"] == "MATCH"
    assert status_map["vendor"] == "MATCH"
    assert score_loose == 1.0

    diffs_fuzzy, _ = diff.reconcile_records(
        {"name": {"value": "Acme Limited"}},
        {"name": "Acme Ltd"},
        strategy="fuzzy",
    )
    assert diffs_fuzzy[0]["status"] == "MATCH"
