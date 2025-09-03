#!/usr/bin/env python3
"""Check what tables exist in the database."""

import sqlite3

def check_tables():
    """List all tables in the database."""
    print("=== DATABASE TABLES ===")

    try:
        conn = sqlite3.connect('udoc.db')
        cursor = conn.cursor()

        cursor.execute('SELECT name FROM sqlite_master WHERE type="table"')
        tables = cursor.fetchall()

        print(f"Found {len(tables)} tables:")
        for table in tables:
            print(f"  {table[0]}")

        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_tables()
