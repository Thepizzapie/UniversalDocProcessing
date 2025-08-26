install:
	uv pip install -r der_pipeline/requirements.txt

fmt:
	black der_pipeline && ruff --fix der_pipeline && isort der_pipeline

test:
	pytest

dev-backend:
	cd der_pipeline && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8080

dev-frontend:
	cd test_web_app && npm start

dev:
	@echo "🚀 To start both servers, run these in separate terminals:"
	@echo "Terminal 1: make dev-backend"
	@echo "Terminal 2: make dev-frontend"
	@echo ""
	@echo "Or run: ./start_dev_servers.ps1"

.PHONY: install fmt test dev dev-backend dev-frontend