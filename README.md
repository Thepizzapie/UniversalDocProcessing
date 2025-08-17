# Document AI Framework

> AI-only document classification and extraction service (Vision + Chat)

## What This Framework Does

- **Document Processing**: Upload any invoice, receipt, or custom document as image/PDF
- **AI-Powered**: Classification + extraction using OpenAI (`MODEL_NAME` for text processing, `VISION_MODEL_NAME` for image analysis)
- **Plug-and-Play**: Integrate into your existing backend with minimal code changes
- **Structured Output**: Get clean JSON data ready for your database
- **Configurable**: Add new document types by updating simple JSON instructions

## Quick Start

### 1) Install dependencies
```bash
pip install -r requirements.txt
```

### 2) Configure environment
Create a `.env` file (see `.env.example` below):
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
curl -X POST -F "file=@sample.pdf" http://localhost:8080/classify-extract
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

## Integration Guide (brief)

### Backend Integration (Any Framework)

**Add to your existing API in just 3 lines:**

```python
from document_processing.pipeline import run_pipeline

@app.post("/process-document")
async def process_document(file: UploadFile):
    result = await asyncio.to_thread(run_pipeline, file.file.read())
    return result["data"]  # Clean structured data
```

**That's it!** Your backend now has AI document processing.

See `sdk/client.py` for a Python client. The long React example was moved out of Quick Start to keep this README concise.

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

## Custom Frontend & Backend Integration

The full React and backend examples have been moved to `docs/frontend_example.md`.

### **Key Differences from Demo Web App**

#### **1. API Response Handling**

**Demo Web App:**
- Directly maps fields and saves to database
- Returns HTML redirect response

**Custom Implementation:**
- Returns JSON data for frontend consumption
- Allows frontend to handle success/error states
- Provides extracted data for validation

#### **2. File Upload Handling**

**Demo Web App:**
- Uses FastAPI `UploadFile` directly
- Processes file synchronously

**Custom Implementation:**
- Uses framework-specific upload handlers (multer, MultiPartParser)
- May implement async processing for better UX
- Can add file validation and security checks

#### **3. Error Handling**

**Demo Web App:**
- Returns HTML error pages
- Simple error messages

**Custom Implementation:**
- Returns structured JSON error responses
- Detailed error handling for API consumers
- Frontend can show user-friendly error messages

#### **4. Authentication & Authorization**

**Demo Web App:**
- No authentication (demo purposes)

**Custom Implementation:**
- Integrate with your auth system
- Add user permissions for document types
- Track document ownership

#### **5. Database Integration**

**Demo Web App:**
- Uses SQLModel with SQLite
- Simple schema

**Custom Implementation:**
- Integrate with existing database/ORM
- Complex relationships and business logic
- Data validation and constraints

### **Environment Configuration**

Update your environment variables:

```bash
# .env file for your custom app

# Document AI Framework Configuration
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

# OCR Configuration (Future Enhancement)
OCR_ENABLED=false                                 # Enable OCR processing
TESSERACT_CMD=/usr/bin/tesseract                  # Path to Tesseract binary
POPPLER_PATH=/usr/bin                             # Path to Poppler utilities
OCR_LANG=eng                                      # OCR language

# Demo Web App Integration
DOC_API_BASE_URL=http://localhost:8080            # Document AI Framework API
DOC_API_TOKEN=your-optional-token                 # API authentication token

# Optional: Distributed Rate Limiting
REDIS_URL=redis://localhost:6379                  # Redis for distributed rate limiting

# Your existing application variables
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

This approach gives you maximum flexibility while leveraging the powerful Document AI Framework for extraction!

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

**2. Docker Deployment**
```yaml
# docker-compose.yml (example)
version: '3.8'
services:
  doc-ai-1:
    build: .
    ports: 
      - "8080:8080"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - MODEL_NAME=${MODEL_NAME:-gpt-5}
      - VISION_MODEL_NAME=${VISION_MODEL_NAME:-gpt-4o}
  
  doc-ai-2:
    build: .
    ports: 
      - "8081:8080"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - MODEL_NAME=${MODEL_NAME:-gpt-5}
      - VISION_MODEL_NAME=${VISION_MODEL_NAME:-gpt-4o}
```

**3. Kubernetes Deployment**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: doc-ai-framework
spec:
  replicas: 3
  selector:
    matchLabels:
      app: doc-ai
  template:
    spec:
      containers:
      - name: doc-ai
        image: doc-ai-framework:latest
        ports:
        - containerPort: 8080
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

- **`document_processing/`**: AI processing engine
- **`service/`**: REST API endpoints  
- **`sdk/`**: Python client library
- **`demo_web/`**: Example web application

## Project Structure

```
doc_ai_project/
│
├── document_processing/     # Core AI processing logic (AI-only)
│   ├── config/
│   │   └── doc_types.json   # Document type definitions
│   ├── config.py            # Configuration management
│   ├── doc_classifier.py    # Document classification
│   ├── doc_extractor.py     # Data extraction
│   ├── pipeline.py          # Processing pipeline
│   └── agents.py            # AI agent implementations
│
├── service/                 # FastAPI web service
│   ├── api.py               # REST API endpoints
│   └── templates/           # HTML templates
│
├── sdk/                     # Python client SDK
│   └── client.py            # API client library
│
├── demo_web/                # Example web application
│   ├── main.py              # Demo web interface
│   ├── models.py            # Database models
│   └── templates/           # Web templates
│
├── tests/                   # Test suite
├── Dockerfile               # Container definition
├── requirements.txt         # Python dependencies
├── pyproject.toml           # Packaging metadata
├── CODE_OF_CONDUCT.md       # Community standards
├── CONTRIBUTING.md          # How to contribute
├── env.example              # Environment variable template
├── LICENSE                  # Apache-2.0 license
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

## Step-by-Step: Adding Load Sheet Uploader (Demo)

Follow this complete guide to add a load sheet uploader to your demo web application, just like we did for invoices and receipts.

### **Step 1: Add Load Sheet Upload Routes**

Edit `demo_web/main.py` and add these two routes after the existing load sheet routes:

```python
@router.get("/load-sheets/upload", response_class=HTMLResponse)
def upload_load_sheet_form(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("loads_upload.html", {"request": request})


@router.post("/load-sheets/upload")
def upload_load_sheet(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a load sheet image/PDF, send to the document API, and save to DB."""
    base_url = os.environ.get("DOC_API_BASE_URL", "http://127.0.0.1:8080")

    files = {"file": (file.filename or "upload", file.file, file.content_type or "application/octet-stream")}
    data = {
        # Force 'load_sheet' type for proper field mapping
        "doc_type": "load_sheet",
        "return_text": "false",
        "use_agents": "true",
        "refine": "true",
        "ocr_fallback": "true",
    }
    headers = {}
    token = os.environ.get("DOC_API_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        resp = requests.post(
            f"{base_url}/classify-extract",
            files=files,
            data=data,
            headers=headers,
            timeout=120,
        )
        resp.raise_for_status()
    except Exception as err:
        from fastapi.responses import HTMLResponse
        msg = (
            f"Upload failed contacting Document API at {base_url}. "
            f"Error: {err}. Ensure the API is running (python -m uvicorn service.api:app --port 8080) "
            f"or set DOC_API_BASE_URL."
        )
        return HTMLResponse(f"<p>{msg}</p><p><a href='/load-sheets/upload'>Back</a></p>", status_code=502)
    payload = resp.json()
    extracted = payload.get("data") or {}

    # Map extracted fields to load sheet database fields
    load_number = _pick_first(extracted, [
        "Load Number",
        "load_number",
        "BOL Number",
        "Bill of Lading",
        "Reference Number",
    ]) or ""

    pickup_location = _pick_first(extracted, [
        "Pickup Location",
        "pickup_location", 
        "Origin",
        "Pickup Address",
        "From",
    ]) or ""

    dropoff_location = _pick_first(extracted, [
        "Dropoff Location",
        "dropoff_location",
        "Destination", 
        "Delivery Address",
        "To",
    ]) or ""

    pickup_date = _pick_first(extracted, [
        "Pickup Date",
        "pickup_date",
        "Load Date",
        "Departure Date",
    ]) or ""

    dropoff_date = _pick_first(extracted, [
        "Dropoff Date", 
        "dropoff_date",
        "Delivery Date",
        "Arrival Date",
    ]) or ""

    carrier_name = _pick_first(extracted, [
        "Carrier Name",
        "carrier_name",
        "Carrier",
        "Trucking Company",
        "Driver",
    ]) or ""

    # Extract weight - handle various units
    weight_str = _pick_first(extracted, [
        "Total Weight (lbs)",
        "total_weight_lbs",
        "Weight",
        "Total Weight",
        "Gross Weight",
    ]) or ""
    
    # Extract numeric weight value
    import re as _re
    weight_match = _re.search(r"[-+]?[0-9]*\.?[0-9]+", str(weight_str))
    total_weight_lbs = float(weight_match.group(0)) if weight_match else 0.0

    item = LoadSheetEntry(
        load_number=load_number or (file.filename or ""),
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        pickup_date=pickup_date,
        dropoff_date=dropoff_date,
        carrier_name=carrier_name,
        total_weight_lbs=total_weight_lbs,
    )
    db.add(item)
    db.commit()
    return RedirectResponse(url="/load-sheets", status_code=303)
```

### **Step 2: Create Load Sheet Upload Template**

Create `demo_web/templates/loads_upload.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Upload Load Sheet</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; }
      form > div { margin-bottom: 10px; }
    </style>
  </head>
  <body>
    <h1>Upload Load Sheet</h1>
    <p><a href="/load-sheets">Back to list</a></p>
    <form method="post" enctype="multipart/form-data">
      <div>
        <label>File (PDF or image)
          <input type="file" name="file" accept="application/pdf,image/*" required />
        </label>
      </div>
      <button type="submit">Upload & Save</button>
    </form>
  </body>
</html>
```

### **Step 3: Add Upload Link to Load Sheet List**

Edit `demo_web/templates/loads_list.html` and add the upload link:

```html
<p><a href="/">Home</a> <a href="/load-sheets/new">New Load Sheet</a> <a href="/load-sheets/upload">Upload Load Sheet</a></p>
```

### **Step 4: Configure Load Sheet Instructions**

Your `document_processing/config/doc_types.json` should already have load sheet configuration. If not, add:

```json
{
  "load_sheet": {
    "description": "Load sheet or bill of lading document",
    "instructions": {
      "schema": {
        "load_number": "Load number, BOL number, or reference number",
        "pickup_location": "Pickup address or origin location",
        "dropoff_location": "Delivery address or destination location",
        "pickup_date": "Date of pickup or departure (YYYY-MM-DD)",
        "dropoff_date": "Date of delivery or arrival (YYYY-MM-DD)",
        "carrier_name": "Trucking company or carrier name",
        "total_weight_lbs": "Total weight in pounds (numeric value only)"
      },
      "guidelines": [
        "Convert weights to pounds if given in other units",
        "Normalize dates to YYYY-MM-DD when possible",
        "Extract numeric values as numbers, not strings"
      ]
    },
    "profile": {
      "keywords": ["load", "BOL", "bill of lading", "carrier", "pickup", "delivery"],
      "likely_fields": ["load_number", "pickup_location", "dropoff_location", "total_weight_lbs"],
      "confidence_hints": ["origin/destination blocks", "weight with units"]
    }
  }
}
```

### **Step 5: Update Document Type Enum**

Ensure `document_processing/doc_classifier.py` includes load_sheet:

```python
class DocumentType(str, Enum):
    INVOICE = "invoice"
    RECEIPT = "receipt"
    LOAD_SHEET = "load_sheet"  # Make sure this exists
```

### **Step 6: Test Your Load Sheet Uploader**

1. **Restart your demo web app** to pick up the new routes
2. **Navigate to** http://127.0.0.1:8090/load-sheets
3. **Click "Upload Load Sheet"**
4. **Select a load sheet image/PDF**
5. **Upload and verify** the extracted data appears in the list

### **How the Framework Linking Works**

When you upload a load sheet:

1. **Frontend** → `POST /load-sheets/upload` with file
2. **Demo Web** → Calls Document AI API with `doc_type=load_sheet`
3. **AI Framework** → Uses load_sheet JSON instructions for extraction
4. **Vision Fallback (optional)** → Extracts structured data from the image if OCR/text path yields no data
5. **Field Mapping** → Maps AI output to database schema
6. **Database** → Saves LoadSheetEntry with clean data

```mermaid
graph LR
    A[Load Sheet Image] → B[Upload Form]
    B → C[Demo Web API]
    C → D[Document AI API]
    D → E[GPT-5 Vision]
    E → F[Structured JSON]
    F → G[Database Table]
```

### **Field Mapping Strategy**

The `_pick_first()` function tries multiple field name variations:

```python
# Example: Load number can be called different things
load_number = _pick_first(extracted, [
    "Load Number",      # Exact match
    "load_number",      # Snake case  
    "BOL Number",       # Bill of Lading
    "Reference Number", # Generic reference
])
```

This handles variations in how different companies label their documents.

### **Pro Tips for Load Sheet Instructions**

1. **Be specific about units**: "Total weight in pounds (numeric value only)"
2. **Handle date formats**: "Format dates as MM/DD/YYYY" 
3. **Account for variations**: Include common field name variations
4. **Specify data types**: "Return numeric values for weights"

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

Apache-2.0 - see `LICENSE`.

---

**Ready to transform your document processing?** Get started in 5 minutes!