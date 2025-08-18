#!/usr/bin/env python3
"""
Main entry point for the Document AI Service.

This script provides a simple way to start the service with proper configuration
validation and error handling.
"""

import logging
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("doc_ai_main")


def main():
    """Main entry point."""
    try:
        # Import after setting up the path
        from document_processing.config import validate_config

        # Validate configuration
        logger.info("Starting Document AI Service...")
        logger.info("Validating configuration...")

        if not validate_config():
            logger.error(
                "Configuration validation failed. Please check your environment variables."
            )
            sys.exit(1)

        logger.info("Configuration validation passed.")

        # Start the document processing API service
        logger.info("Starting Document AI Framework API...")
        import uvicorn

        uvicorn.run("service.api:app", host="127.0.0.1", port=8080, reload=False, log_level="info")

    except KeyboardInterrupt:
        logger.info("Service stopped by user.")
    except Exception as e:
        logger.error("Failed to start service: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
