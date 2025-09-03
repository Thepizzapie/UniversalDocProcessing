#!/usr/bin/env python3
"""Simple debug script to check custom document types."""

import sqlite3

def debug_custom_types():
    """List all custom document types in the SQLite database."""
    print("=== SIMPLE CUSTOM DOCUMENT TYPES DEBUG ===")

    try:
        # Connect to the SQLite database
        conn = sqlite3.connect('udoc.db')
        cursor = conn.cursor()

        # Query custom document types for tenant 1
        cursor.execute("""
            SELECT id, name, description, output_schema, pipeline_config
            FROM customdoctypedefinition
            WHERE tenant_id = 1
        """)

        rows = cursor.fetchall()
        print(f"Found {len(rows)} custom document types for tenant 1:")
        print()

        for i, (id, name, description, output_schema, pipeline_config) in enumerate(rows, 1):
            print(f"{i}. ID: {id}")
            print(f"   Name: '{name}'")
            print(f"   Description: '{description}'")

            try:
                import json
                if output_schema:
                    schema_dict = json.loads(output_schema)
                    print(f"   Has Output Schema: True ({len(schema_dict)} fields)")
                    print(f"   Schema Keys: {list(schema_dict.keys())}")
                else:
                    print("   Has Output Schema: False")
            except:
                print(f"   Output Schema: {output_schema[:100] if output_schema else 'None'}...")

            try:
                if pipeline_config:
                    config_dict = json.loads(pipeline_config)
                    if 'steps' in config_dict:
                        print(f"   Pipeline Steps: {len(config_dict['steps'])}")
                        for j, step in enumerate(config_dict['steps']):
                            print(f"      {j+1}. {step.get('step_type', 'unknown')}")
                    else:
                        print("   Pipeline Config: Has config but no steps")
                else:
                    print("   Has Pipeline Config: False")
            except:
                print(f"   Pipeline Config: {pipeline_config[:100] if pipeline_config else 'None'}...")

            print()

        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_custom_types()
