"""Application configuration management."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_env: str = "dev"
    debug: bool = False
    api_host: str = "0.0.0.0"
    api_port: int = 8080

    # Database
    database_url: str = "sqlite:///./udoc.db"
    postgres_url: str | None = None

    # Server settings
    host: str = "127.0.0.1"
    port: int = 8080

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # Vector Database
    qdrant_url: str = "http://qdrant:6333"

    # External API timeouts
    external_timeout_seconds: int = 20

    # Reconciliation thresholds
    fuzzy_threshold: float = 0.85
    amount_tolerance: float = 0.01  # $0.01
    pct_tolerance: float = 0.005  # 0.5%
    date_tolerance_days: int = 1

    # OCR settings
    ocr_enabled: bool = True
    ocr_language: str = "eng"

    # LLM/AI settings
    llm_provider: str = "openai"  # echo, openai, anthropic
    openai_api_key: str | None = None
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0.2
    llm_max_tokens: int = 2000

    # CORS
    cors_allow_origins: list[str] = ["http://localhost:3000"]

    # JWT
    jwt_secret: str = "change_me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    # Rate limiting
    rate_limit_per_minute: int = 60

    # CrewAI settings
    crewai_enabled: bool = False
    crewai_memory_enabled: bool = True
    crewai_max_execution_time: int = 300  # 5 minutes
    crewai_verbose: bool = False

    # LangChain settings
    langchain_verbose: bool = False
    langchain_debug: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()

def reload_settings():
    """Reload settings from environment/files."""
    global settings
    settings = Settings()
    return settings

def get_current_settings():
    """Get current settings (can be dynamically updated)."""
    return settings
