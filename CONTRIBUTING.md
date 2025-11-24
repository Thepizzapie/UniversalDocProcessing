# Contributing

Thanks for your interest in contributing! We welcome issues and pull requests.

## Setup

- Python 3.11+
- Create a virtual environment
- `pip install -r requirements.txt`
- `uvicorn service.api:app --host 0.0.0.0 --port 8080`

## Running with Docker

- `docker build -t doc-ai-service .`
- `docker run -p 8080:8080 -e OPENAI_API_KEY=your-key doc-ai-service`

## Tests

TBD. Please include lightweight tests or sample requests in your PR description.

## Pull Requests

- Fork and create a feature branch
- Keep changes focused
- Update README if APIs or behavior change
- Ensure no secrets are committed

## Code of Conduct

See `CODE_OF_CONDUCT.md`.

