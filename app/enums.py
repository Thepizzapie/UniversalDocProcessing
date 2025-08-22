from enum import Enum


class PipelineState(str, Enum):
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
    SYSTEM = "SYSTEM"
    USER = "USER"
    AGENT = "AGENT"


class Decision(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
