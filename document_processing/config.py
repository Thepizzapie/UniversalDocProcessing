"""
Configuration management for the document processing framework.

This module centralizes all environment variable handling and provides
validation to ensure the framework is properly configured.
"""

import logging
import os
from pathlib import Path
from typing import Any, Dict

logger = logging.getLogger("doc_ai_config")


class Config:
    """Centralized configuration for the document processing framework."""
    
    def __init__(self):
        """Initialize configuration from environment variables."""
        # OpenAI Configuration
        self.openai_api_key = os.environ.get("OPENAI_API_KEY")
        self.openai_api_base = os.environ.get("OPENAI_API_BASE_URL", "https://api.openai.com/v1")
        self.model_name = os.environ.get("MODEL_NAME", "gpt-5")
        
        # OCR Configuration
        self.tesseract_cmd = os.environ.get("TESSERACT_CMD")
        self.poppler_path = os.environ.get("POPPLER_PATH")
        self.ocr_lang = os.environ.get("OCR_LANG", "eng")
        
        # API Security Configuration
        self.allowed_tokens = {
            t.strip() for t in os.environ.get("ALLOWED_TOKENS", "").split(",") if t.strip()
        }
        self.require_auth = bool(self.allowed_tokens)
        
        # Processing Limits
        self.max_file_size_mb = int(os.environ.get("MAX_FILE_SIZE_MB", "15"))
        self.allow_file_urls = os.environ.get("ALLOW_FILE_URLS", "true").lower() in {
            "1", "true", "yes"
        }
        self.max_concurrency = int(os.environ.get("MAX_CONCURRENCY", "4"))
        self.rate_limit_per_min = int(os.environ.get("RATE_LIMIT_PER_MIN", "60"))
        
        # Demo Web Configuration
        self.doc_api_base_url = os.environ.get("DOC_API_BASE_URL", "http://127.0.0.1:8080")
        self.doc_api_token = os.environ.get("DOC_API_TOKEN")
        
    def validate(self) -> Dict[str, Any]:
        """Validate configuration and return validation results.
        
        Returns:
            Dictionary with validation results including errors and warnings.
        """
        errors = []
        warnings = []
        
        # Critical validations
        if not self.openai_api_key:
            errors.append("OPENAI_API_KEY is required but not set")
            
        # OCR validations
        if self.tesseract_cmd and not Path(self.tesseract_cmd).exists():
            warnings.append(f"TESSERACT_CMD path does not exist: {self.tesseract_cmd}")
            
        if self.poppler_path and not Path(self.poppler_path).exists():
            warnings.append(f"POPPLER_PATH does not exist: {self.poppler_path}")
            
        # Model validation
        supported_models = [
            "gpt-5", "gpt-4o", "gpt-4o-mini", "gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"
        ]
        if self.model_name not in supported_models:
            warnings.append(
                f"MODEL_NAME '{self.model_name}' may not be supported. "
                f"Supported: {supported_models}"
            )
            
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
    
    def log_validation(self) -> bool:
        """Log validation results and return True if configuration is valid."""
        validation = self.validate()
        
        if validation["errors"]:
            for error in validation["errors"]:
                logger.error("Configuration error: %s", error)
                
        if validation["warnings"]:
            for warning in validation["warnings"]:
                logger.warning("Configuration warning: %s", warning)
                
        if validation["valid"]:
            logger.info("Configuration validation passed")
        else:
            logger.error("Configuration validation failed")
            
        return validation["valid"]
    
    def get_doc_types_path(self) -> Path:
        """Get the path to the document types configuration file."""
        return Path(__file__).resolve().parent / "config" / "doc_types.yaml"


# Global configuration instance
config = Config()


def get_config() -> Config:
    """Get the global configuration instance."""
    return config


def validate_config() -> bool:
    """Validate the global configuration and log results."""
    return config.log_validation()
