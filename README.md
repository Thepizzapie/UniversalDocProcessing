# Doc AI Project

> Status: Work in progress (WIP) framework. Interfaces and internals may evolve as we stabilize the plugin model, agents, and deployment options.

This project bundles a plug‑and‑play document processing framework along with
Python client code.  It builds upon the `document_processing` package and
includes an HTTP API powered by FastAPI and a simple Python SDK for
integrating the service into any backend.  The service performs OCR,
classifies documents into known types, and extracts structured fields from
scanned documents.

## Contents

```
doc_ai_project/
│
├── document_processing/     # Core classification, OCR and extraction logic
│   ├── config/
│   │   └── doc_types.yaml   # Document type definitions and extraction instructions
│   ├── doc_classifier.py    # LLM‑based document classifier
│   ├── doc_extractor.py     # OCR and extraction helper functions
│   ├── pipeline.py          # High‑level wrapper used by the service
│   └── __init__.py
│
├── service/
│   ├── api.py               # FastAPI web service exposing `/classify-extract`
│   └── __init__.py
│
├── sdk/
│   ├── client.py            # Python client to call the service
│   └── __init__.py
│
├── Dockerfile               # Container definition to run the service
├── requirements.txt         # Python dependencies
└── README.md                # This file
```

## Quick start

1. **Build and run with Docker**

   ```bash
   cd doc_ai_project
   docker build -t doc-ai-service .
   docker run -p 8080:8080 -e OPENAI_API_KEY=<your-key> doc-ai-service
   ```

2. **Call the service using curl**

   ```bash
   curl -X POST -F "file=@/path/to/document.pdf" http://localhost:8080/classify-extract
   ```

3. **Use the Python SDK**

   ```python
   from sdk.client import DocAI
   client = DocAI("http://localhost:8080")
   result = client.classify_extract(file_path="/path/to/document.pdf")
   print(result)
   ```

Refer to the `document_processing` package for details on how document types and extraction instructions are defined.

## Open Source

This project is open source under the MIT License. See `LICENSE`.

- Contributing: see `CONTRIBUTING.md`
- Code of Conduct: see `CODE_OF_CONDUCT.md`
- Security Policy: see `SECURITY.md`
- Example environment: see `.env.example`