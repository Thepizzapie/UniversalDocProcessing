# UniversalDocProcessing

A modular 5-step document data entry and reconciliation pipeline built with FastAPI and SQLModel.

## Pipeline
1. **Ingest & Extract** – Upload a document and extract fields using pluggable OCR/LLM adapters.
2. **Human-in-the-Loop Verify** – Review and correct extracted fields.
3. **Fetch Comparator Data** – Retrieve reference records from external systems.
4. **Reconcile** – Compare corrected data with fetched records using strict/loose/fuzzy strategies.
5. **Final Approval** – Approve or reject the document with an audit trail of all transitions.

## Development
```bash
make install
make dev  # starts uvicorn
make test
```

The API is fully JSON based. Visit `/docs` for interactive documentation. A minimal HiL web UI is served at `/hil_ui`.
