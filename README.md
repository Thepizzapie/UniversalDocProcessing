# Document AI Framework

> AI-only document classification and extraction service (Vision + Chat)

## What This Framework Does

- **Document Processing**: Upload any invoice, receipt, or custom document as image/PDF
- **AI-Powered**: Classification + extraction using OpenAI (`MODEL_NAME` for text processing, `VISION_MODEL_NAME` for image analysis)
- **Plug-and-Play**: Integrate into your existing backend with minimal code changes
- **Structured Output**: Get clean JSON data ready for your database
- **Configurable**: Add new document types by updating simple JSON instructions
- **Production Ready**: Health checks, rate limiting, auth tokens, and concurrency limits

## Quick Start

### 1) Install dependencies
```bash
pip install -r requirements.txt

# Optional: Install CrewAI for advanced agent functionality (may have dependency conflicts)
# pip install -r config/requirements-crewai.txt
```

### 2) Configure environment
Create a `.env` file (see `config/env.example`):
```env
OPENAI_API_KEY=sk-your-key-here
MODEL_NAME=gpt-5
VISION_MODEL_NAME=gpt-4o
OPENAI_API_BASE_URL=https://api.openai.com/v1
MAX_CONCURRENCY=4
RATE_LIMIT_PER_MIN=60
```

### 3) Start the service
```bash
python main.py
```

### 4) Try it
```bash
# Single document processing
curl -X POST -F "file=@sample.pdf" http://localhost:8080/classify-extract

# Check service health
curl http://localhost:8080/health

```

## How It Works

### Processing flow (AI-only)

1. Classification: Uses vision models to classify documents directly from images/PDFs
2. Extraction: Extract structured fields using JSON-based instructions via vision models
3. Vision Fallback: Primary extraction method uses OpenAI Vision API for image understanding
4. Output: JSON suitable for your backend

**Note**: This framework is designed as AI-only by default. OCR libraries are included for future enhancement but are not currently active in the pipeline.

```json
{
  "classification": { "type": "invoice", "confidence": 0.95 },
  "data": {
    "invoice_number": "INV-2024-001",
    "vendor_name": "Acme Corp",
    "total_amount": 1250.00,
    "invoice_date": "2024-01-15"
  }
}
```

## Integration Guide

### Using the Python SDK (Recommended)

**Easy integration with the Python client:**

```python
from sdk.client import DocAI

# Initialize client
client = DocAI("http://localhost:8080", token="your-api-token")

# Process a document
result = client.classify_extract(file_path="/path/to/invoice.pdf")
print(f"Document type: {result['classification']['type']}")
print(f"Extracted data: {result['data']}")

# Async processing
result = await client.classify_extract_async(file_path="/path/to/document.pdf")
```

### Direct Pipeline Integration

**Embed directly into your backend:**

```python
from document_processing.pipeline import run_pipeline

@app.post("/process-document")
async def process_document(file: UploadFile):
    result = await asyncio.to_thread(run_pipeline, file.file.read())
    return result["data"]  # Clean structured data
```

### Database Integration

**Map extracted data to your existing tables:**

```python
# Your existing database model
invoice = Invoice(
    number=extractedData.get('invoice_number'),
    vendor=extractedData.get('vendor_name'),
    amount=extractedData.get('total_amount'),
    date=extractedData.get('invoice_date')
)
db.save(invoice)
```

## API Endpoints

### Core Processing Endpoints

#### `POST /classify-extract`
Process a single document and return structured data.

**Parameters:**
- `file`: Document file (multipart upload)
- `file_url`: Alternative URL to document
- `doc_type`: Force specific document type (optional)
- `use_agents`: Enable CrewAI agents (default: true)
- `refine`: Enable refinement pass (default: true)
- `callback_url`: Async processing callback (optional)

**Response:**
```json
{
  "classification": {
    "type": "invoice",
    "confidence": 0.95
  },
  "data": {
    "invoice_number": "INV-2024-001",
    "vendor_name": "Acme Corp",
    "total_amount": 1250.00,
    "invoice_date": "2024-01-15"
  }
}
```

#### `POST /classify-extract-batch`
Process multiple documents concurrently.

**Parameters:**
- `files`: Array of document files
- `doc_type`: Force specific document type (optional)
- `use_agents`: Enable CrewAI agents (default: true)
- `refine`: Enable refinement pass (default: true)

### Health Endpoint

#### `GET /health`
Basic health check for load balancers and monitoring.

## Environment Configuration

Core configuration for the Document AI Framework:

```bash
# Required: OpenAI Configuration
OPENAI_API_KEY=sk-your-key-here                    # Required: OpenAI API key
MODEL_NAME=gpt-5                                   # Chat model for text processing
VISION_MODEL_NAME=gpt-4o                           # Vision model for image processing
OPENAI_API_BASE_URL=https://api.openai.com/v1     # OpenAI API base URL

# Processing Limits
MAX_CONCURRENCY=4                                  # Concurrent processing limit
RATE_LIMIT_PER_MIN=60                             # API rate limiting
MAX_FILE_SIZE_MB=15                               # Maximum file size

# Security & Authentication
ALLOWED_TOKENS=token1,token2,token3               # Comma-separated API tokens
ALLOW_FILE_URLS=true                              # Allow processing from URLs

# Optional: Distributed Rate Limiting
REDIS_URL=redis://localhost:6379                  # Redis for distributed rate limiting
```

## Document Type Configuration (JSON)

### Setting Up Instructions for Your Document Types

The framework uses a JSON file to define what data to extract from each document type. This is where the magic happens!

#### 1. Edit the Configuration File

Open `document_processing/config/doc_types.json` and add your document types. Each type contains:
- `description`: human description
- `instructions.schema`: keys to extract with descriptions
- `instructions.guidelines`: bullet points the model should follow
- `profile`: optional keywords/likely fields

```json
{
  "purchase_order": {
    "description": "Purchase Order document",
    "instructions": {
      "schema": {
        "po_number": "Purchase order number",
        "vendor_name": "Supplier company name",
        "order_date": "Date the order was placed (YYYY-MM-DD)",
        "delivery_date": "Expected delivery date (YYYY-MM-DD)",
        "total_amount": "Total dollar amount (numeric)",
        "line_items": "Array of items being ordered with description, quantity, unit_price, amount"
      },
      "guidelines": [
        "Extract numeric values as numbers, not strings",
        "Normalize dates to YYYY-MM-DD when possible",
        "Parse line_items as an array of objects"
      ]
    },
    "profile": {
      "keywords": ["purchase order", "PO", "vendor", "delivery"],
      "likely_fields": ["po_number", "vendor_name", "total_amount"],
      "confidence_hints": ["presence of 'PO' or 'Purchase Order' in title"]
    }
  },
  "shipping_label": {
    "description": "Shipping label",
    "instructions": {
      "schema": {
        "tracking_number": "Package tracking number",
        "sender_name": "Name of sender",
        "recipient_name": "Name of recipient",
        "delivery_address": "Full delivery address",
        "weight": "Package weight (numeric value with units)",
        "service_type": "Shipping service (overnight, ground, etc.)"
      },
      "guidelines": [
        "Extract tracking number as string",
        "Include full address with city, state, zip",
        "Convert weight to standard units if possible"
      ]
    },
    "profile": {
      "keywords": ["tracking", "delivery", "shipping", "address"],
      "likely_fields": ["tracking_number", "delivery_address", "weight"],
      "confidence_hints": ["barcode present", "shipping service logos"]
    }
  }
}
```

#### 2. Update the Document Types Enum

Add your new document type to `document_processing/doc_classifier.py`:

```python
class DocumentType(str, Enum):
    INVOICE = "invoice"
    RECEIPT = "receipt" 
    LOAD_SHEET = "load_sheet"
    PURCHASE_ORDER = "purchase_order"      # Add your new type
    SHIPPING_LABEL = "shipping_label"      # Add your new type
```

#### 3. Test Your New Document Type

```bash
curl -X POST \
  -F "file=@purchase_order.pdf" \
  -F "doc_type=purchase_order" \
  http://localhost:8080/classify-extract
```

### Pro Tips for Writing Instructions

- **Be specific**: Use exact field names you want in the output JSON
- **Include examples**: "Format dates as YYYY-MM-DD"
- **Handle variations**: "Total amount could be labeled as 'Total', 'Amount Due', or 'Grand Total'"
- **Set data types**: "Return numeric values for amounts, not strings"

## Scaling Your Implementation

### Horizontal Scaling

**1. Multiple API Instances**
```bash
# Run multiple instances behind a load balancer
uvicorn service.api:app --host 0.0.0.0 --port 8080 --workers 4
```

### Performance Optimization

**1. Async Processing for High Volume**
```python
# Handle multiple documents concurrently
@app.post("/process-batch")
async def process_batch(files: List[UploadFile]):
    tasks = [
        asyncio.to_thread(run_pipeline, file.file.read()) 
        for file in files
    ]
    results = await asyncio.gather(*tasks)
    return results
```

**2. Caching for Repeated Documents**
```python
# Cache results based on file hash
import hashlib
from functools import lru_cache

@lru_cache(maxsize=1000)
def process_cached(file_hash: str, file_content: bytes):
    return run_pipeline(file_content)
```

**3. Database Optimization**
```python
# Bulk insert for high volume
def save_batch(extracted_documents):
    Invoice.objects.bulk_create([
        Invoice(**doc_data) for doc_data in extracted_documents
    ])
```

## OCR (Future Enhancement)

The current implementation is **AI-only** and uses OpenAI Vision models for direct image understanding. OCR libraries are included in the dependencies for future enhancement but are not currently active in the processing pipeline.

### Current Vision-Based Approach

The framework directly processes images and PDFs using:
- **OpenAI Vision API** for image classification and extraction
- **PDF to image conversion** for PDF processing
- **No intermediate OCR text step** - works directly with visual content

### OCR Integration (Future)

If you want to add OCR support:

**1. Install OCR Dependencies**
```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr poppler-utils

# macOS  
brew install tesseract poppler

# Windows
# Download Tesseract from: https://github.com/UB-Mannheim/tesseract/wiki
# Download Poppler from: https://github.com/oschwartz10612/poppler-windows
```

**2. Configure OCR Paths (Windows)**
```env
OCR_ENABLED=true
TESSERACT_CMD=C:\\Program Files\\Tesseract-OCR\\tesseract.exe
POPPLER_PATH=C:\\path\\to\\poppler\\bin
```

**3. Modify Pipeline**
Update `pipeline.py` to enable OCR text extraction before vision processing.

### Benefits of Current Vision Approach

- **No OCR preprocessing** required
- **Better handling of complex layouts** (tables, forms, mixed content)
- **Direct understanding** of visual elements like logos, signatures
- **Robust with poor quality scans** or photographed documents

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Your Frontend │────│  Document AI API │────│  OpenAI Model    │
│   (File Upload) │    │   (This Framework)│    │   (gpt-5)        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Your Database   │
                       │ (Structured Data)│
                       └──────────────────┘
```

### Core Components

- **`document_processing/`**: AI processing engine with classification and extraction
- **`service/`**: Production-ready REST API with monitoring and health checks
- **`sdk/`**: Python client library for easy integration
- **`tests/`**: Comprehensive test suite for quality assurance

## Project Structure

```
document_ai_framework/
│
├── document_processing/     # Core AI processing logic
│   ├── config/
│   │   └── doc_types.json   # Document type definitions
│   ├── config.py            # Configuration management
│   ├── doc_classifier.py    # Document classification
│   ├── doc_extractor.py     # Data extraction
│   ├── pipeline.py          # Processing pipeline
│   └── agents.py            # AI agent implementations
│
├── service/                 # FastAPI web service
│   └── api.py               # REST API endpoints (includes /health)
│
├── sdk/                     # Python client SDK
│   └── client.py            # Easy-to-use API client
│
├── tests/                   # Test suite
│   ├── test_api.py          # API endpoint tests
│   ├── test_classifier.py   # Classification tests
│   ├── test_extractor.py    # Extraction tests
│   ├── test_pipeline.py     # Pipeline tests
│   └── test_sdk.py          # SDK tests
│
├── config/                  # Configuration files
│   ├── env.example          # Environment variable template
│   └── requirements-crewai.txt # Optional CrewAI dependencies
│
├── docs/                    # Documentation
│   ├── CODE_OF_CONDUCT.md   # Community standards
│   └── LICENSE              # MIT license
│
├── .github/                 # CI/CD workflows
│   ├── workflows/           # GitHub Actions
│   └── dependabot.yml       # Dependency automation
│
├── Dockerfile               # Container definition
├── requirements.txt         # Core dependencies
├── pyproject.toml           # Package metadata
├── README.md                # Main documentation
└── main.py                  # Entry point
```

## Testing & Development

### Running Tests
```bash
# Full test suite
python -m pytest tests/

# Test document processing
python -m pytest tests/test_pipeline.py

# Test API endpoints
python -m pytest tests/test_api.py
```

### Development Setup
```bash
# Install dependencies and dev tools
pip install -r requirements.txt
pip install pytest pytest-asyncio

# Format code
black document_processing/ service/ sdk/

# Lint code  
ruff check document_processing/ service/ sdk/
```

## Deployment Options

### Option 1: Simple Server
```bash
uvicorn service.api:app --host 0.0.0.0 --port 8080
```

### Option 2: Docker
```bash
docker build -t doc-ai-framework .
docker run -p 8080:8080 -e OPENAI_API_KEY=your-key doc-ai-framework
```

### Option 3: Cloud Deployment
```bash
# Heroku
git push heroku main

# AWS/GCP/Azure
# Use the included Dockerfile for container deployment
```



## Use Cases

This framework is perfect for:

- **Invoice Processing**: Automate accounts payable
- **Receipt Management**: Expense tracking systems  
- **Load Sheet Processing**: Logistics and freight management
- **Shipping Labels**: Package tracking and fulfillment
- **Purchase Orders**: Procurement automation
- **Medical Forms**: Healthcare document processing
- **Financial Documents**: Banking and insurance
- **Any Custom Document**: Just update the JSON configuration!

## Contributing

We welcome contributions!

## License

MIT - see `LICENSE`.

## Security & Authentication

- Bearer token support is built-in (set `ALLOWED_TOKENS` in `.env`).
- For OAuth2/OpenID Connect, place a reverse proxy (e.g. NGINX, API Gateway) in front of this service to validate tokens and forward authenticated requests with a `Bearer` token header. Provide examples in deployment configs.
- Distributed rate limiting: set `REDIS_URL` to enable Redis-backed per-IP limits. For multi-region or Kubernetes, use a global Redis/ElastiCache or API Gateway rate-limiting.

## OCR Integration (How-To)

If the vision-only approach struggles with certain scans, you can enable OCR.

1) Install OCR dependencies
```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr poppler-utils

# macOS
brew install tesseract poppler

# Windows
# Tesseract: https://github.com/UB-Mannheim/tesseract/wiki
# Poppler:   https://github.com/oschwartz10612/poppler-windows
```

2) Configure OCR in `.env`
```env
OCR_ENABLED=true
TESSERACT_CMD=/usr/bin/tesseract   # or Windows path
POPPLER_PATH=/usr/local/bin        # where pdfimages/pdftoppm live
```

3) Pipeline hook (example)
```python
from document_processing.ocr import to_text  # implement a helper that uses pytesseract/pdfminer

text = to_text(file_path)  # use when OCR_ENABLED is true before calling classification
```

4) Troubleshooting
- Ensure the binaries are on PATH.
- For PDFs, convert to images before OCR or use pdfminer.

---



## MCP Integration

### Enabling MCP Connections

The framework supports integration with MCP servers for tool discovery and execution. By default, MCP connections are disabled, and agents run independently. To enable MCP connections:

1. Update the `.env` file:

```env
ENABLE_MCP=true
MCP_SERVER_CMD=your-mcp-server-command
MCP_SERVER_ARGS=your-mcp-server-arguments
ALLOWLIST_TOOLS=tool1,tool2
BLOCKLIST_TOOLS=tool3,tool4
```

2. Restart the service:

```bash
python main.py
```

### Using MCP Tools

When MCP is enabled, agents can discover and use tools provided by the MCP server. Tool filtering can be configured using allowlists and blocklists in the `.env` file.

### Example

```python
from document_processing.agents import extract_with_agent

# Enable MCP in the environment
os.environ["ENABLE_MCP"] = "true"
os.environ["MCP_SERVER_CMD"] = "mock_mcp_server"
os.environ["MCP_SERVER_ARGS"] = "--mock-args"

# Run extraction with MCP tools
result = extract_with_agent("Sample text", "Sample instructions")
print(result)
```