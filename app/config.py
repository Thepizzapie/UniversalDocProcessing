from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    app_env: str = "dev"
    database_url: str = "sqlite:///./app.db"
    external_timeout_seconds: int = 20
    fuzzy_threshold: float = 0.85
    amount_tolerance: float = 0.01
    pct_tolerance: float = 0.005
    date_tolerance_days: int = 1

    class Config:
        env_file = ".env"


settings = Settings()
