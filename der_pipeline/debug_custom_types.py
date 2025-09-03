#!/usr/bin/env python3
"""Debug script to check custom document types in the database."""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db import get_session_sync
from app.models import CustomDocTypeDefinition

def debug_custom_types():
    """List all custom document types for tenant 1."""
    print("=== CUSTOM DOCUMENT TYPES DEBUG ===")

    with get_session_sync() as session:
        custom_types = session.query(CustomDocTypeDefinition).filter(
            CustomDocTypeDefinition.tenant_id == 1
        ).all()

        print(f"Found {len(custom_types)} custom document types for tenant 1:")
        print()

        for i, ct in enumerate(custom_types, 1):
            print(f"{i}. ID: {ct.id}")
            print(f"   Name: '{ct.name}'")
            print(f"   Description: '{ct.description}'")
            print(f"   Has Output Schema: {bool(ct.output_schema)}")
            print(f"   Has Pipeline Config: {bool(ct.pipeline_config)}")

            if ct.pipeline_config:
                if isinstance(ct.pipeline_config, dict):
                    steps = ct.pipeline_config.get('steps', [])
                    print(f"   Pipeline Steps: {len(steps)}")
                    for j, step in enumerate(steps):
                        print(f"      {j+1}. {step.get('step_type', 'unknown')}")
                else:
                    print(f"   Pipeline Config (raw): {ct.pipeline_config}")

            if ct.output_schema:
                if isinstance(ct.output_schema, dict):
                    field_count = len(ct.output_schema)
                    print(f"   Schema Fields: {field_count}")
                    print(f"   Schema Keys: {list(ct.output_schema.keys())}")
                else:
                    print(f"   Output Schema (raw): {ct.output_schema}")

            print()

if __name__ == "__main__":
    debug_custom_types()
