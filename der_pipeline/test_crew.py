#!/usr/bin/env python3
"""Test CrewAI crew initialization"""
import sys
import os

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "app"))


def test_crew_initialization():
    """Test if the CrewAI crew can be initialized properly"""
    try:
        from agents.crew_manager import DocumentProcessingCrew

        print("DEBUG: Creating DocumentProcessingCrew...")
        crew = DocumentProcessingCrew("gpt-4o")
        print("SUCCESS: Crew initialized successfully!")

        # Test if we can access the agents
        print(f"DEBUG: Extraction agent: {crew.extraction_agent}")
        print(f"DEBUG: Validation agent: {crew.validation_agent}")
        print(f"DEBUG: Reconciliation agent: {crew.reconciliation_agent}")

        return True

    except Exception as e:
        print(f"ERROR: Crew initialization failed: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_crew_initialization()
    exit(0 if success else 1)
