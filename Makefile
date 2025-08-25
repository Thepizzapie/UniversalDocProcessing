.PHONY: help install dev test clean build run docs

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install:  ## Install dependencies
	pip install -e .

dev:  ## Run development server
	uvicorn app.main:app --reload --host 127.0.0.1 --port 8080

test:  ## Run tests
	pytest tests/ -v



clean:  ## Clean up cache and build artifacts
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	rm -rf build/
	rm -rf dist/
	rm -rf .pytest_cache/

build:  ## Build package
	python -m build

docs:  ## Open API documentation
	@echo "API docs available at: http://127.0.0.1:8080/docs"
	@echo "Alternative docs at: http://127.0.0.1:8080/redoc"

run: dev  ## Alias for dev

migrate:  ## Create/update database tables
	python -c "from app.db import create_tables; create_tables(); print('Database tables created/updated')"



# Docker commands (if using Docker)
docker-build:  ## Build Docker image
	docker build -t universal-doc-processing .

docker-run:  ## Run with Docker
	docker run -p 8080:8080 -e DATABASE_URL=sqlite:///./app.db universal-doc-processing
