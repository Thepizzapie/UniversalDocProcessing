"""SQL database connector for fetching reference data."""

import random
from typing import Any

from loguru import logger


def fetch_data(connection_string: str, query: str, document_data: dict[str, Any]) -> dict[str, Any]:
    """Fetch data from SQL database.

    Args:
        connection_string: Database connection string
        query: SQL query to execute
        document_data: Document data for query parameters

    Returns:
        Query results
    """

    # For demo purposes, simulate database queries
    # In production, you would use actual database connections

    logger.info(f"Simulating SQL query execution: {query[:100]}...")

    try:
        # Simulate different query results based on document type
        doc_type = document_data.get("document_type", "unknown")

        if "invoice" in query.lower() or doc_type.lower() == "invoice":
            results = _simulate_invoice_query(document_data)
        elif "employee" in query.lower() or doc_type.lower() == "entry_exit_log":
            results = _simulate_employee_query(document_data)
        elif "merchant" in query.lower() or doc_type.lower() == "receipt":
            results = _simulate_merchant_query(document_data)
        else:
            results = _simulate_generic_query(document_data)

        return {
            "source": "sql_query",
            "status": "success",
            "data": results,
            "row_count": len(results) if isinstance(results, list) else 1,
            "query": query,
            "fetch_timestamp": "2024-08-24T10:30:00Z",
            "metadata": {
                "connection_string": connection_string.replace("password=", "password=***"),
                "execution_time_ms": random.randint(10, 100),
                "database_type": "postgresql",
            },
        }

    except Exception as e:
        logger.error(f"SQL query execution failed: {e}")
        return {
            "source": "sql_query",
            "status": "error",
            "error": str(e),
            "query": query,
            "fetch_timestamp": "2024-08-24T10:30:00Z",
        }


def _simulate_invoice_query(document_data: dict[str, Any]) -> list[dict[str, Any]]:
    """Simulate invoice lookup query results."""
    return [
        {
            "vendor_id": f"VND-{random.randint(1000, 9999)}",
            "vendor_name": "Verified Systems LLC",
            "tax_id": f"TAX-{random.randint(100000, 999999)}",
            "status": "active",
            "credit_limit": round(random.uniform(10000, 100000), 2),
            "payment_terms": "NET30",
            "contact_email": "billing@verified-systems.com",
            "last_payment_date": "2024-08-15",
            "outstanding_balance": round(random.uniform(0, 5000), 2),
        }
    ]


def _simulate_employee_query(document_data: dict[str, Any]) -> list[dict[str, Any]]:
    """Simulate employee lookup query results."""
    return [
        {
            "employee_id": f"EMP-{random.randint(1000, 9999)}",
            "full_name": "Jane Smith",
            "department": "Engineering",
            "hire_date": "2022-03-15",
            "status": "active",
            "access_level": "standard",
            "manager": "John Manager",
            "email": "jane.smith@company.com",
            "badge_number": f"B{random.randint(10000, 99999)}",
            "shift_start": "08:00:00",
            "shift_end": "17:00:00",
        }
    ]


def _simulate_merchant_query(document_data: dict[str, Any]) -> list[dict[str, Any]]:
    """Simulate merchant lookup query results."""
    return [
        {
            "merchant_id": f"MCH-{random.randint(1000, 9999)}",
            "business_name": "TechMart Electronics",
            "business_type": "retail",
            "tax_id": f"TX{random.randint(100000000, 999999999)}",
            "address": "456 Commerce St, Tech City, TC 12345",
            "phone": "(555) 987-6543",
            "status": "verified",
            "registration_date": "2020-05-20",
            "last_audit": "2024-07-15",
            "compliance_score": round(random.uniform(0.8, 1.0), 2),
        }
    ]


def _simulate_generic_query(document_data: dict[str, Any]) -> list[dict[str, Any]]:
    """Simulate generic reference data query."""
    return [
        {
            "reference_id": f"REF-{random.randint(10000, 99999)}",
            "entity_type": "document_validation",
            "status": "active",
            "created_date": "2024-08-20",
            "last_updated": "2024-08-24",
            "confidence_score": round(random.uniform(0.7, 1.0), 2),
            "validation_flags": random.sample(["verified", "complete", "reviewed"], 2),
            "metadata": {"source_system": "reference_db", "data_quality": "high"},
        }
    ]

