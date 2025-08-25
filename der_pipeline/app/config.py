"""Application configuration management."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_env: str = "dev"
    debug: bool = False

    # Database
    database_url: str = "sqlite:///./app.db"
    
    # Server settings
    host: str = "127.0.0.1"
    port: int = 8080

    # External API timeouts
    external_timeout_seconds: int = 20

    # Reconciliation thresholds
    fuzzy_threshold: float = 0.85
    amount_tolerance: float = 0.01  # $0.01
    pct_tolerance: float = 0.005  # 0.5%
    date_tolerance_days: int = 1

    # OCR settings (for future implementation)
    ocr_enabled: bool = False
    ocr_language: str = "eng"

    # LLM/AI settings
    llm_provider: str = "openai"  # echo, openai, anthropic
    openai_api_key: str | None = None
    llm_model: str = "gpt-4o"
    llm_temperature: float = 0.1
    llm_max_tokens: int = 2000

    # CrewAI settings
    crewai_enabled: bool = True
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
