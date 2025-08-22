install:
pip install -e .

dev:
uvicorn app.main:app --reload

test:
pytest -q

fmt:
ruff format && ruff check --fix
