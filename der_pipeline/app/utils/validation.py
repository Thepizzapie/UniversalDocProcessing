"""Validation utilities for document processing."""

from typing import Any
from datetime import datetime


def validate_document_content(content: str, mime_type: str) -> bool:
    """Validate document content based on mime type."""

    if not content:
        return False

    # Basic content size validation
    if len(content) > 50 * 1024 * 1024:  # 50MB limit
        return False

    # Mime type specific validations
    if mime_type.startswith("image/"):
        # For images, content should be base64 or binary
        return len(content) > 100  # Minimum reasonable size

    elif mime_type == "application/pdf":
        # PDF validation - should contain PDF header
        return content.startswith("%PDF-") or b"%PDF-" in content.encode("latin1")

    elif mime_type.startswith("text/"):
        # Text files should have reasonable content
        return len(content.strip()) > 0

    # Default: accept if content exists
    return True


def validate_extracted_fields(fields: dict[str, Any]) -> dict[str, list[str]]:
    """Validate extracted fields and return errors."""

    errors = {}

    # Common field validations
    if "amount" in fields:
        amount = fields["amount"]
        if isinstance(amount, (int, float)):
            if amount < 0:
                errors["amount"] = ["Amount cannot be negative"]
            elif amount > 999999.99:  # Reasonable upper limit
                errors["amount"] = ["Amount seems unreasonably high"]
        else:
            errors["amount"] = ["Amount must be a number"]

    if "date" in fields:
        date_value = fields["date"]
        if isinstance(date_value, str):
            try:
                # Try to parse as date
                datetime.strptime(date_value, "%Y-%m-%d")
            except ValueError:
                errors["date"] = ["Invalid date format. Use YYYY-MM-DD"]

    if "invoice_number" in fields:
        inv_num = fields["invoice_number"]
        if isinstance(inv_num, str):
            if len(inv_num.strip()) == 0:
                errors["invoice_number"] = ["Invoice number cannot be empty"]
            elif len(inv_num) > 50:  # Reasonable length limit
                errors["invoice_number"] = ["Invoice number too long"]

    return errors


def validate_correction_fields(
    original_fields: dict[str, Any], corrected_fields: dict[str, Any]
) -> dict[str, list[str]]:
    """Validate corrected fields against original extractions."""

    errors = {}

    # Check that corrected fields don't introduce new invalid data
    base_errors = validate_extracted_fields(corrected_fields)
    errors.update(base_errors)

    # Additional validation specific to corrections
    for field_name, corrected_value in corrected_fields.items():
        if field_name in original_fields:
            original_value = original_fields[field_name]

            # Check for suspicious changes
            if isinstance(original_value, (int, float)) and isinstance(
                corrected_value, (int, float)
            ):
                if (
                    abs(corrected_value - original_value) / abs(original_value) > 1.0
                ):  # 100% change
                    errors.setdefault(field_name, []).append(
                        "Correction represents >100% change from original"
                    )

    return errors


def validate_reconciliation_thresholds(
    thresholds: dict[str, float],
) -> dict[str, list[str]]:
    """Validate reconciliation threshold values."""

    errors = {}

    if "exact" in thresholds:
        exact = thresholds["exact"]
        if not 0.0 <= exact <= 1.0:
            errors["exact"] = ["Exact threshold must be between 0.0 and 1.0"]

    if "fuzzy" in thresholds:
        fuzzy = thresholds["fuzzy"]
        if not 0.0 <= fuzzy <= 1.0:
            errors["fuzzy"] = ["Fuzzy threshold must be between 0.0 and 1.0"]

    if "exact" in thresholds and "fuzzy" in thresholds:
        if thresholds["fuzzy"] > thresholds["exact"]:
            errors["thresholds"] = ["Fuzzy threshold should not exceed exact threshold"]

    return errors


def sanitize_filename(filename: str) -> str:
    """Sanitize filename for safe storage."""

    # Remove dangerous characters
    import re

    sanitized = re.sub(r'[<>:"/\\|?*]', "_", filename)

    # Limit length
    if len(sanitized) > 100:
        name, ext = sanitized.rsplit(".", 1) if "." in sanitized else (sanitized, "")
        max_name_len = 100 - len(ext) - 1 if ext else 100
        sanitized = name[:max_name_len] + ("." + ext if ext else "")

    return sanitized
