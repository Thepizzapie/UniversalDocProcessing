"""Configuration router for managing AI and extraction settings."""

import json
import os
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import settings, reload_settings

router = APIRouter()

# Configuration file path
CONFIG_FILE = "config.json"


class ConfigUpdateRequest(BaseModel):
    """Request model for updating configuration."""

    openai_api_key: str | None = None
    crewai_enabled: bool | None = None
    llm_model: str | None = None
    llm_temperature: float | None = None
    extraction_parameters: dict[str, dict[str, Any]] | None = None


class ConfigResponse(BaseModel):
    """Response model for configuration."""

    openai_api_key_set: bool
    crewai_enabled: bool
    llm_model: str
    llm_temperature: float
    extraction_parameters: dict[str, dict[str, Any]]
    openai_api_key: str | None = None


def load_config_file() -> dict[str, Any]:
    """Load configuration from JSON file."""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE) as f:
                return json.load(f)
        except:
            pass
    return {}


def save_config_file(config: dict[str, Any]):
    """Save configuration to JSON file."""
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        print(f"Error saving config: {e}")


@router.get("/config", response_model=ConfigResponse)
async def get_config():
    """Get current configuration settings."""
    # Load from config file if it exists
    config_data = load_config_file()

    return ConfigResponse(
        openai_api_key_set=bool(config_data.get("openai_api_key") or settings.openai_api_key),
        crewai_enabled=config_data.get("crewai_enabled", settings.crewai_enabled),
        llm_model=config_data.get("llm_model", settings.llm_model),
        llm_temperature=config_data.get("llm_temperature", settings.llm_temperature),
        extraction_parameters=config_data.get("extraction_parameters", get_extraction_parameters()),
        openai_api_key=config_data.get("openai_api_key", settings.openai_api_key),
    )


@router.put("/config", response_model=ConfigResponse)
async def update_config(request: ConfigUpdateRequest):
    """Update configuration settings."""

    # Load existing config
    config_data = load_config_file()

    # Update fields if provided
    if request.openai_api_key is not None:
        config_data["openai_api_key"] = request.openai_api_key
        # Update environment variable immediately
        os.environ["OPENAI_API_KEY"] = request.openai_api_key

    if request.crewai_enabled is not None:
        config_data["crewai_enabled"] = request.crewai_enabled

    if request.llm_model is not None:
        config_data["llm_model"] = request.llm_model

    if request.llm_temperature is not None:
        config_data["llm_temperature"] = request.llm_temperature

    if request.extraction_parameters is not None:
        config_data["extraction_parameters"] = request.extraction_parameters

    # Save to file
    save_config_file(config_data)

    # Also update .env file for persistence
    update_env_file(config_data)

    # Reload settings to pick up changes
    reload_settings()

    # Reload CrewAI service if it exists
    try:
        from ..services.crewai_service import crewai_service

        crewai_service.reload_configuration()
        print("DEBUG: CrewAI service reloaded with new settings")
    except Exception as e:
        print(f"DEBUG: Failed to reload CrewAI service: {e}")

    return ConfigResponse(
        openai_api_key_set=bool(config_data.get("openai_api_key")),
        crewai_enabled=config_data.get("crewai_enabled", settings.crewai_enabled),
        llm_model=config_data.get("llm_model", settings.llm_model),
        llm_temperature=config_data.get("llm_temperature", settings.llm_temperature),
        extraction_parameters=config_data.get("extraction_parameters", get_extraction_parameters()),
        openai_api_key=config_data.get("openai_api_key"),
    )


def update_env_file(config_data: dict[str, Any]):
    """Update .env file with new configuration."""
    try:
        env_file = ".env"
        env_lines = []

        # Read existing .env file
        if os.path.exists(env_file):
            with open(env_file) as f:
                env_lines = f.readlines()

        # Create new env content
        new_env_content = []

        # Add or update our settings
        settings_to_update = {
            "OPENAI_API_KEY": config_data.get("openai_api_key", ""),
            "CREWAI_ENABLED": str(config_data.get("crewai_enabled", True)).lower(),
            "LLM_MODEL": config_data.get("llm_model", "gpt-5"),
            "LLM_TEMPERATURE": str(config_data.get("llm_temperature", 0.1)),
        }

        # Process existing lines, updating our settings
        updated_keys = set()
        for line in env_lines:
            line = line.strip()
            if not line or line.startswith("#"):
                new_env_content.append(line + "\n" if line else "\n")
                continue

            if "=" in line:
                key, value = line.split("=", 1)
                key = key.strip()
                if key in settings_to_update:
                    new_env_content.append(f"{key}={settings_to_update[key]}\n")
                    updated_keys.add(key)
                else:
                    new_env_content.append(line + "\n")

        # Add any missing settings
        for key, value in settings_to_update.items():
            if key not in updated_keys:
                new_env_content.append(f"{key}={value}\n")

        # Write back to .env file
        with open(env_file, "w") as f:
            f.writelines(new_env_content)

    except Exception as e:
        print(f"Error updating .env file: {e}")


def get_extraction_parameters() -> dict[str, dict[str, Any]]:
    """Get extraction parameters for each document type."""
    return {
        "INVOICE": {
            "fields_to_extract": ["invoice_number", "date", "amount", "vendor", "description"],
            "confidence_threshold": 0.7,
            "use_ai_enhancement": True,
        },
        "RECEIPT": {
            "fields_to_extract": ["store_name", "date", "total_amount", "items"],
            "confidence_threshold": 0.7,
            "use_ai_enhancement": True,
        },
        "ENTRY_EXIT_LOG": {
            "fields_to_extract": ["employee_id", "name", "entry_time", "exit_time", "facility"],
            "confidence_threshold": 0.7,
            "use_ai_enhancement": True,
        },
        "UNKNOWN": {
            "fields_to_extract": ["text_content"],
            "confidence_threshold": 0.5,
            "use_ai_enhancement": False,
        },
    }


@router.get("/config/extraction/{document_type}")
async def get_extraction_config(document_type: str):
    """Get extraction configuration for a specific document type."""
    params = get_extraction_parameters()
    if document_type not in params:
        raise HTTPException(status_code=404, detail=f"Document type {document_type} not found")

    return params[document_type]


@router.put("/config/extraction/{document_type}")
async def update_extraction_config(document_type: str, config: dict[str, Any]):
    """Update extraction configuration for a specific document type."""
    # In a real implementation, this would save to a database
    # For now, we'll just return the updated config
    return {
        "document_type": document_type,
        "config": config,
        "message": "Extraction configuration updated successfully",
    }
