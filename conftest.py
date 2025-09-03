"""Configure test environment for the project.

Pytest does not automatically add the project root to ``sys.path`` when the
package is not installed.  The tests import ``document_processing`` directly,
so we ensure the repository root is available on ``sys.path`` during test
collection.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
