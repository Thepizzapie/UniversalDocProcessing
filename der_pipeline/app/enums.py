"""Pipeline state and action enums."""

from enum import Enum


class PipelineState(str, Enum):
    """Document processing pipeline states."""

    INGESTED = "INGESTED"
    HIL_REQUIRED = "HIL_REQUIRED"
    HIL_CONFIRMED = "HIL_CONFIRMED"
    FETCH_PENDING = "FETCH_PENDING"
    FETCHED = "FETCHED"
    RECONCILED = "RECONCILED"
    FINAL_REVIEW = "FINAL_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


class ActorType(str, Enum):
    """Types of actors that can perform actions."""

    SYSTEM = "SYSTEM"
    USER = "USER"
    AGENT = "AGENT"


class ReconcileStrategy(str, Enum):
    """Reconciliation strategies."""

    STRICT = "STRICT"
    LOOSE = "LOOSE"
    FUZZY = "FUZZY"


class ReconcileStatus(str, Enum):
    """Field-level reconciliation status."""

    MATCH = "MATCH"
    MISMATCH = "MISMATCH"
    MISSING_BOTH = "MISSING_BOTH"
    ONLY_EXTRACTED = "ONLY_EXTRACTED"
    ONLY_FETCHED = "ONLY_FETCHED"


class Decision(str, Enum):
    """Final decision outcomes."""

    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class FetchStatus(str, Enum):
    """Fetch job status."""

    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class DocumentType(str, Enum):
    """Document types for specialized processing."""

    INVOICE = "INVOICE"
    RECEIPT = "RECEIPT"
    ENTRY_EXIT_LOG = "ENTRY_EXIT_LOG"
    UNKNOWN = "UNKNOWN"