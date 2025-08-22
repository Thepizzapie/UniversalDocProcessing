from __future__ import annotations

import re
from typing import Any, Dict, Tuple

from dateutil import parser
from rapidfuzz import fuzz

from ..config import settings


def _normalize(value: str) -> str:
    s = re.sub(r"\s+", " ", value).strip().casefold()
    s = re.sub(r"[$,.]", "", s)
    return s


def _numeric_equal(a: Any, b: Any) -> bool:
    try:
        a_val = float(str(a).replace(",", ""))
        b_val = float(str(b).replace(",", ""))
    except Exception:
        return False
    diff = abs(a_val - b_val)
    return diff <= max(settings.amount_tolerance, settings.pct_tolerance * abs(b_val))


def _date_equal(a: Any, b: Any) -> bool:
    try:
        da = parser.parse(str(a)).date()
        db = parser.parse(str(b)).date()
    except Exception:
        return False
    return abs((da - db).days) <= settings.date_tolerance_days


def _loose_equal(a: Any, b: Any) -> bool:
    if _numeric_equal(a, b) or _date_equal(a, b):
        return True
    if isinstance(a, str) and isinstance(b, str):
        return _normalize(a) == _normalize(b)
    return a == b


def _fuzzy_equal(a: Any, b: Any) -> bool:
    if _loose_equal(a, b):
        return True
    if isinstance(a, str) and isinstance(b, str):
        score = (
            max(
                fuzz.token_sort_ratio(_normalize(a), _normalize(b)),
                fuzz.partial_ratio(_normalize(a), _normalize(b)),
            )
            / 100.0
        )
        return score >= settings.fuzzy_threshold
    return False


def reconcile_records(
    extracted: Dict[str, Any], fetched: Dict[str, Any], strategy: str = "loose"
) -> Tuple[list, float]:
    fields = set(extracted.keys()) | set(fetched.keys())
    diffs = []
    matches = 0
    for field in fields:
        ev = extracted.get(field)
        ev_val = ev.get("value") if isinstance(ev, dict) and "value" in ev else ev
        fv = fetched.get(field)
        status = "MISSING_BOTH"
        score = 0.0
        if ev_val is None and fv is None:
            status = "MISSING_BOTH"
        elif ev_val is not None and fv is None:
            status = "ONLY_EXTRACTED"
        elif ev_val is None and fv is not None:
            status = "ONLY_FETCHED"
        else:
            if strategy == "strict":
                equal = ev_val == fv
            elif strategy == "fuzzy":
                equal = _fuzzy_equal(ev_val, fv)
            else:
                equal = _loose_equal(ev_val, fv)
            if equal:
                status = "MATCH"
                score = 1.0
                matches += 1
            else:
                status = "MISMATCH"
                if strategy == "fuzzy" and isinstance(ev_val, str) and isinstance(fv, str):
                    score = (
                        max(
                            fuzz.token_sort_ratio(_normalize(ev_val), _normalize(fv)),
                            fuzz.partial_ratio(_normalize(ev_val), _normalize(fv)),
                        )
                        / 100.0
                    )
        diffs.append(
            {
                "field": field,
                "extracted_value": ev_val,
                "fetched_value": fv,
                "match_score": score,
                "status": status,
            }
        )
    score_overall = matches / len(fields) if fields else 1.0
    return diffs, score_overall
