"""Example vendor external API adapter."""

import asyncio
import random
from typing import Any

from ...models import Document
from ...schemas import FetchedRecord
from .base import BaseExternalApiAdapter


class ExampleVendorAdapter(BaseExternalApiAdapter):
    """Example vendor adapter that returns synthetic comparator data."""

    def __init__(self):
        super().__init__(
            base_url="https://api.example-vendor.com",  # Placeholder URL
            api_key="demo-key",  # Would come from config
        )

    async def fetch(self, document: Document) -> FetchedRecord:
        """Fetch comparator data from example vendor."""

        # In a real implementation, you would:
        # 1. Extract relevant identifiers from document/corrections
        # 2. Make API call to external vendor
        # 3. Parse and return structured data

        # For demo purposes, return synthetic data
        demo_data = self._generate_demo_data(document)

        # Simulate API delay
        await asyncio.sleep(0.5)

        return FetchedRecord(source="example_vendor", payload=demo_data)

    def _generate_demo_data(self, document: Document) -> dict[str, Any]:
        """Generate synthetic demo data for comparison."""

        # Create deterministic but varied demo data based on document ID
        seed = hash(document.id) % 1000

        return {
            "vendor_name": f"Vendor {seed % 10 + 1} Inc",
            "invoice_number": "03d",
            "date": "04d",
            "amount": round(100 + (seed % 900), 2),  # $100-999.99
            "currency": "USD",
            "status": random.choice(["paid", "pending", "overdue"]),
            "due_date": "04d",
            "customer_reference": "03d",
            "line_items": [
                {
                    "description": f"Service item {(seed + i) % 5 + 1}",
                    "quantity": (seed + i) % 10 + 1,
                    "unit_price": round(10 + ((seed + i) % 90), 2),
                    "total": round(10 + ((seed + i) % 90) * ((seed + i) % 10 + 1), 2),
                }
                for i in range((seed % 3) + 1)  # 1-4 line items
            ],
            "tax_amount": round(10 + (seed % 50), 2),
            "total_amount": round(120 + (seed % 900), 2),
            "payment_terms": random.choice(["Net 30", "Net 15", "Due on Receipt"]),
            "confidence": 0.9,
        }
