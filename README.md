# Document AI Framework

> **Production-Ready**: A complete plug-and-play document processing framework powered by GPT-5 Vision

Transform any image or PDF into structured data with just a few lines of code. This framework handles document classification, field extraction, and data processing using advanced AI - no machine learning expertise required.

## What This Framework Does

- **Document Processing**: Upload any invoice, receipt, or custom document as image/PDF
- **AI-Powered Extraction**: Uses GPT-5 Vision to intelligently extract structured data
- **Plug-and-Play**: Integrate into your existing backend with minimal code changes
- **Structured Output**: Get clean JSON data ready for your database
- **Configurable**: Add new document types by updating simple YAML instructions

## Quick Start (5 Minutes)

### 1. Installation
```bash
git clone <repository-url>
cd doc_ai_project
python setup.py  # Automated setup
```

### 2. Configuration
```bash
# Add your OpenAI API key
echo "OPENAI_API_KEY=sk-your-key-here" > .env
```

### 3. Run the Framework
```bash
# Start the API service
python main.py
```

### 4. Test Document Processing
```bash
# Upload a receipt/invoice image
curl -X POST -F "file=@test_receipt.txt" http://localhost:8080/classify-extract
```

**Output**: Clean JSON data ready for your database!

## How It Works

### The Magic Behind the Scenes

1. **Upload**: Send any image/PDF to the API endpoint
2. **AI Classification**: GPT-5 Vision identifies document type (invoice, receipt, etc.)
3. **Data Extraction**: AI extracts structured fields based on your configurations
4. **Clean Output**: Get perfect JSON ready for your database

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

### Frontend Integration

**Simple file upload component:**

```javascript
const uploadDocument = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/process-document', {
    method: 'POST',
    body: formData
  });
  
  const extractedData = await response.json();
  // extractedData contains structured fields ready for your database
};
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

## Custom Frontend & Backend Integration

**Note:** Setting up the Document AI framework with your own frontend and backend may differ slightly from the demo web application. Here's how to integrate it into a real-world React application with a custom backend.

### **React Frontend Example**

#### **1. File Upload Component**

Create a React component for document upload:

```jsx
// components/DocumentUploader.jsx
import React, { useState } from 'react';
import axios from 'axios';

const DocumentUploader = ({ documentType, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', documentType);

    try {
      // Call your backend API endpoint
      const response = await axios.post('/api/documents/process', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Handle successful extraction
      onSuccess(response.data);
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="document-uploader">
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileChange}
        disabled={loading}
      />
      <button 
        onClick={handleUpload} 
        disabled={!file || loading}
        className="upload-btn"
      >
        {loading ? 'Processing...' : 'Upload & Extract'}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default DocumentUploader;
```

#### **2. Invoice Management Page**

```jsx
// pages/InvoiceManager.jsx
import React, { useState, useEffect } from 'react';
import DocumentUploader from '../components/DocumentUploader';
import axios from 'axios';

const InvoiceManager = () => {
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await axios.get('/api/invoices');
      setInvoices(response.data);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    }
  };

  const handleUploadSuccess = (extractedData) => {
    // Show success message
    alert('Invoice processed successfully!');
    
    // Refresh the invoice list
    fetchInvoices();
    
    // Optionally, show extracted data for review
    console.log('Extracted data:', extractedData);
  };

  return (
    <div className="invoice-manager">
      <h1>Invoice Management</h1>
      
      <div className="upload-section">
        <h2>Upload New Invoice</h2>
        <DocumentUploader 
          documentType="invoice"
          onSuccess={handleUploadSuccess}
        />
      </div>

      <div className="invoice-list">
        <h2>Recent Invoices</h2>
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Vendor</th>
              <th>Amount</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(invoice => (
              <tr key={invoice.id}>
                <td>{invoice.invoice_number}</td>
                <td>{invoice.vendor_name}</td>
                <td>${invoice.total_amount}</td>
                <td>{invoice.invoice_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvoiceManager;
```

### **Custom Backend Integration**

#### **1. Express.js + Node.js Backend**

```javascript
// routes/documents.js
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const router = express.Router();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Document processing endpoint
router.post('/process', upload.single('file'), async (req, res) => {
  try {
    const { doc_type } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ detail: 'No file provided' });
    }

    // Call the Document AI Framework API
    const formData = new FormData();
    formData.append('file', file.buffer, file.originalname);
    formData.append('doc_type', doc_type);
    formData.append('use_agents', 'true');
    formData.append('refine', 'true');

    const response = await axios.post(
      `${process.env.DOC_AI_API_URL}/classify-extract`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${process.env.DOC_AI_API_TOKEN}` // if using auth
        }
      }
    );

    const extractedData = response.data.data;

    // Save to your database
    if (doc_type === 'invoice') {
      const invoice = await Invoice.create({
        invoice_number: extractedData.invoice_number,
        vendor_name: extractedData.vendor_name,
        total_amount: parseFloat(extractedData.total_amount),
        invoice_date: extractedData.invoice_date,
        currency: extractedData.currency || 'USD'
      });

      res.json({
        success: true,
        invoice: invoice,
        extracted: extractedData
      });
    }

  } catch (error) {
    console.error('Document processing error:', error);
    res.status(500).json({ 
      detail: error.response?.data?.detail || 'Processing failed' 
    });
  }
});

module.exports = router;
```

#### **2. Django REST Framework Backend**

```python
# views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework import status
import requests
from .models import Invoice
from .serializers import InvoiceSerializer

class DocumentProcessView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get('file')
        doc_type = request.data.get('doc_type')

        if not file:
            return Response({'detail': 'No file provided'}, 
                          status=status.HTTP_400_BAD_REQUEST)

        try:
            # Call Document AI Framework
            files = {'file': (file.name, file, file.content_type)}
            data = {
                'doc_type': doc_type,
                'use_agents': 'true',
                'refine': 'true'
            }

            response = requests.post(
                f"{settings.DOC_AI_API_URL}/classify-extract",
                files=files,
                data=data,
                timeout=120
            )
            response.raise_for_status()

            extracted_data = response.json()['data']

            # Save to database
            if doc_type == 'invoice':
                invoice = Invoice.objects.create(
                    invoice_number=extracted_data.get('invoice_number', ''),
                    vendor_name=extracted_data.get('vendor_name', ''),
                    total_amount=float(extracted_data.get('total_amount', 0)),
                    invoice_date=extracted_data.get('invoice_date', ''),
                    currency=extracted_data.get('currency', 'USD')
                )

                serializer = InvoiceSerializer(invoice)
                return Response({
                    'success': True,
                    'invoice': serializer.data,
                    'extracted': extracted_data
                })

        except requests.RequestException as e:
            return Response({'detail': str(e)}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

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
DOC_AI_API_URL=http://localhost:8080  # Document AI Framework API
DOC_AI_API_TOKEN=your-optional-token  # If using authentication

# Your existing variables
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

This approach gives you maximum flexibility while leveraging the powerful Document AI Framework for extraction!

## Document Type Configuration

### Setting Up Instructions for Your Document Types

The framework uses simple YAML files to define what data to extract from each document type. This is where the magic happens!

#### 1. Edit the Configuration File

Open `document_processing/config/doc_types.yaml` and add your document types:

```yaml
# Example: Purchase Orders
purchase_order:
  description: "Purchase Order document" 
  instructions: |
    Extract the following fields from this purchase order:
      - po_number: Purchase order number
      - vendor_name: Supplier company name  
      - order_date: Date the order was placed
      - delivery_date: Expected delivery date
      - total_amount: Total dollar amount
      - line_items: List of items being ordered
    
    Return JSON with these exact field names.

# Example: Shipping Labels  
shipping_label:
  description: "Shipping label"
  instructions: |
    Extract the following fields:
      - tracking_number: Package tracking number
      - sender_name: Name of sender
      - recipient_name: Name of recipient  
      - delivery_address: Full delivery address
      - weight: Package weight
      - service_type: Shipping service (overnight, ground, etc.)
    
    Return JSON with these exact field names.
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
# docker-compose.yml
version: '3'
services:
  doc-ai-1:
    build: .
    ports: ["8080:8080"]
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
  
  doc-ai-2:
    build: .
    ports: ["8081:8080"] 
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
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

## OCR Fallback (Optional)

By default, the framework uses GPT-5 Vision which works excellently for most documents. However, you can add traditional OCR as a fallback for edge cases.

### Installing OCR Support

**1. Install Tesseract**
```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr

# macOS  
brew install tesseract

# Windows
# Download from: https://github.com/UB-Mannheim/tesseract/wiki
```

**2. Enable OCR Fallback**

Update your `.env` file:
```bash
OCR_PROVIDER=tesseract
OCR_FALLBACK=true
```

**3. OCR Integration Flow**

When enabled, the framework will:
1. **First**: Try GPT-5 Vision (faster, more accurate)
2. **Fallback**: Use OCR + text-based extraction if Vision fails
3. **Combine**: Merge results for maximum data extraction

```python
# The framework automatically handles this, but you can customize:
result = run_pipeline(
    file_content,
    use_agents=True,      # Use GPT-5 Vision
    ocr_fallback=True     # Enable OCR backup
)
```

### When to Use OCR Fallback

- **High volume processing** (OCR is faster for simple text extraction)
- **Low-quality images** (OCR sometimes works better on poor scans)
- **Cost optimization** (OCR is cheaper than Vision API calls)
- **Offline processing** (OCR works without internet)

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Your Frontend │────│  Document AI API │────│  GPT-5 Vision   │
│   (File Upload) │    │   (This Framework)│    │   (OpenAI)      │
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
├── document_processing/     # Core AI processing logic
│   ├── config/
│   │   └── doc_types.yaml   # Document type definitions
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
├── .github/                 # GitHub workflows
├── Dockerfile               # Container definition
├── requirements.txt         # Python dependencies
├── setup.py                 # Setup script
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
# Install development dependencies
pip install -r requirements.txt

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

## Step-by-Step: Adding Load Sheet Uploader

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

Your `document_processing/config/doc_types.yaml` should already have load sheet configuration. If not, add:

```yaml
load_sheet:
  description: "Load sheet or bill of lading document"
  instructions: |
    Extract the following fields from this load sheet or bill of lading:
      - load_number: Load number, BOL number, or reference number
      - pickup_location: Pickup address or origin location
      - dropoff_location: Delivery address or destination location  
      - pickup_date: Date of pickup or departure (format as MM/DD/YYYY)
      - dropoff_date: Date of delivery or arrival (format as MM/DD/YYYY)
      - carrier_name: Trucking company or carrier name
      - total_weight_lbs: Total weight in pounds (numeric value only)
    
    Return JSON with these exact field names. Convert weights to pounds if given in other units.
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
3. **AI Framework** → Uses load_sheet YAML instructions for extraction
4. **GPT-5 Vision** → Extracts structured data from the image
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
- **Any Custom Document**: Just update the YAML configuration!

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Ready to transform your document processing?** Get started in 5 minutes!