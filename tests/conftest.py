"""Pytest configuration for the Document AI Framework tests."""

import os
import sys
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Ensure we can import our modules
os.environ.setdefault("PYTHONPATH", str(project_root))
