# Environment Variables

This document lists all environment variables used in the Document AI Framework.

## Required Variables

- `OPENAI_API_KEY`: API key for OpenAI services.
- `MAX_CONCURRENCY`: Maximum number of concurrent requests.
- `RATE_LIMIT_PER_MIN`: Rate limit per client IP per minute.

## Optional Variables

- `REDIS_URL`: URL for Redis server (used for distributed rate limiting).
- `ALLOW_FILE_URLS`: Whether to allow file URLs for document processing.
- `REQUIRE_AUTH`: Whether authentication is required for API endpoints.
- `ALLOWED_TOKENS`: List of bearer tokens allowed for authentication.

## Default Values

- `MAX_FILE_SIZE_MB`: Default is 10 MB.
- `MODEL_NAME`: Default is `gpt-3.5-turbo`.
- `VISION_MODEL_NAME`: Default is `vision-model`.
