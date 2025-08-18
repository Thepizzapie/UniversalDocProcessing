# Contributing

Thank you for your interest in contributing! We welcome issues, discussions, and pull requests.

## Development Setup
- Create and activate a virtual environment
- Install dependencies: `pip install -r requirements.txt`
- Configure environment: `cp env.example .env` and add your OpenAI API key
- Run the framework: `python main.py`
- Test the API: `curl http://localhost:8080/health`
- Run tests: `pytest -q` (if test suite is available)

## Branching Model
- Use feature branches from `dev` (e.g., `feat/batch-endpoint`, `fix/classifier-vision`)
- Open PRs against `dev`

## Coding Guidelines
- Follow the existing code style; keep functions small and readable
- Add type hints to public functions
- Handle errors explicitly and return structured error details
- Keep prompts deterministic; prefer JSON outputs

## Commit Messages
- Use concise messages in imperative mood: `add`, `fix`, `refactor`, `docs`, `test`

## Pull Requests
- Describe the change, rationale, and any tradeoffs
- Include tests for new behavior
- Update documentation (README, examples) when applicable

## Reporting Issues
- Provide reproduction steps, logs, and environment details
- Include sample files if possible

Thanks for helping improve the project!


