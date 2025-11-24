# UDP-Parser Frontend Integration Guide

A comprehensive guide for frontend engineers to integrate the UDP-Parser document processing framework into their existing applications.

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Backend Setup](#backend-setup)
4. [Core Components](#core-components)
5. [Document Type Configuration](#document-type-configuration)
6. [Multi-Document Processing](#multi-document-processing)
7. [Complete Implementation Examples](#complete-implementation-examples)

---

## Overview

The UDP-Parser framework provides AI-powered document classification and data extraction. This guide shows you how to build three essential pages:

1. **Upload Page** - Accept and process document files
2. **Dashboard Page** - List pending and approved documents
3. **Review Page** - Edit extracted data with document preview

### What You'll Need

- React 16.8+ (hooks support)
- HTTP client (axios, fetch, etc.)
- Backend running UDP-Parser on port 8080
- Basic understanding of JSON and REST APIs

---

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Upload Page   │─────▶│  Backend API     │─────▶│  Review Page    │
│  (File input)   │      │  /classify-      │      │  (Edit + Save)  │
│                 │      │   extract        │      │                 │
└─────────────────┘      └──────────────────┘      └─────────────────┘
         │                        │                          │
         │                        ▼                          │
         │               ┌─────────────────┐                │
         └──────────────▶│  Dashboard      │◀───────────────┘
                         │  (Pending/      │
                         │   Approved)     │
                         └─────────────────┘
```

### Data Flow

1. User uploads document(s)
2. Backend performs OCR + Classification + Extraction
3. Results stored in localStorage/state
4. Dashboard shows documents pending review
5. User reviews/edits extracted data
6. User approves or deletes documents

---

## Backend Setup

### Starting the Backend

```powershell
# Option 1: Use the provided script (Windows)
.\start_services.ps1

# Option 2: Manual Docker start
docker run -d -p 8080:8080 -e OPENAI_API_KEY=your_key --name doc-ai doc-ai
```

### API Endpoint

**URL:** `http://localhost:8080/api/classify-extract`

**Method:** `POST`

**Content-Type:** `multipart/form-data`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | File | Yes | The document file (PDF, PNG, JPG, JPEG) |
| `doc_type` | String | No | Force specific document type (e.g., "invoice", "receipt") |
| `use_agents` | String | No | Use AI agents for extraction ("true"/"false", default: "false") |
| `refine` | String | No | Refine extraction results ("true"/"false", default: "false") |
| `return_text` | String | No | Include raw OCR text ("true"/"false", default: "false") |

**Response Format:**

```json
{
  "classification": {
    "type": "invoice",
    "confidence": 0.95
  },
  "data": {
    "Invoice Number": "INV-001",
    "Invoice Date": "2024-01-15",
    "Vendor Name": "Acme Corp",
    "Line Items": [
      {
        "description": "Widget",
        "quantity": "10",
        "unit_price": "25.00",
        "total": "250.00"
      }
    ]
  },
  "raw_text": "Optional OCR text..."
}
```

---

## Core Components

### 1. Upload Component

Create a reusable upload component that handles file selection and API submission.

```jsx
import { useState, useRef } from 'react'
import axios from 'axios'

function DocumentUpload({ docType, onComplete }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return

    // Validate file type
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please upload a PDF or image file (PNG, JPG, JPEG)')
      return
    }

    // Validate file size (10MB max)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setFile(selectedFile)
    setError(null)

    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target.result)
      reader.readAsDataURL(selectedFile)
    } else {
      setPreview(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a file to upload')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('use_agents', 'true')  // Enable AI agents
      formData.append('refine', 'true')       // Enable refinement
      formData.append('return_text', 'false') // Don't need raw text

      // If docType is specified, force that type, otherwise auto-classify
      if (docType) {
        formData.append('doc_type', docType)
      }

      const response = await axios.post('/api/classify-extract', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      // Transform backend response to your format
      const backendData = response.data
      const result = {
        id: Date.now(), // Generate unique ID
        document_type: backendData.classification?.type || 'unknown',
        confidence: backendData.classification?.confidence || 0,
        extracted_data: backendData.data || {},
        raw_text: backendData.raw_text || null,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        preview: preview,
        status: 'pending',
        uploadedAt: new Date().toISOString()
      }

      onComplete(result)

      // Reset form
      setFile(null)
      setPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to process document'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.png,.jpg,.jpeg"
        disabled={loading}
      />

      {preview && <img src={preview} alt="Preview" />}

      {error && <div className="error">{error}</div>}

      <button type="submit" disabled={!file || loading}>
        {loading ? 'Processing...' : 'Process Document'}
      </button>
    </form>
  )
}

export default DocumentUpload
```

### 2. Dashboard Component

Display pending and approved documents with filtering.

```jsx
import { useState } from 'react'

function Dashboard({ documents, onReview, onDelete, onApprove }) {
  const [filter, setFilter] = useState('pending') // 'pending' or 'approved'

  const filteredDocs = documents.filter(doc => doc.status === filter)

  return (
    <div className="dashboard">
      <div className="tabs">
        <button
          className={filter === 'pending' ? 'active' : ''}
          onClick={() => setFilter('pending')}
        >
          Pending Review ({documents.filter(d => d.status === 'pending').length})
        </button>
        <button
          className={filter === 'approved' ? 'active' : ''}
          onClick={() => setFilter('approved')}
        >
          Approved ({documents.filter(d => d.status === 'approved').length})
        </button>
      </div>

      <div className="document-list">
        {filteredDocs.length === 0 ? (
          <p>No {filter} documents</p>
        ) : (
          filteredDocs.map(doc => (
            <div key={doc.id} className="document-card">
              <div className="doc-info">
                <h3>{doc.fileName}</h3>
                <span className="doc-type">{doc.document_type}</span>
                <span className="confidence">{(doc.confidence * 100).toFixed(0)}%</span>
              </div>

              <div className="doc-actions">
                <button onClick={() => onReview(doc)}>
                  Review
                </button>

                {filter === 'pending' && (
                  <button onClick={() => onApprove(doc.id)}>
                    Quick Approve
                  </button>
                )}

                <button onClick={() => onDelete(doc.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Dashboard
```

### 3. Review Editor Component

The most complex component - displays document preview and editable fields.

```jsx
import { useState, useEffect } from 'react'

function ReviewEditor({ document, docType, onClose, onSave, onApprove, onDelete }) {
  const [editedData, setEditedData] = useState({})
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setEditedData(document.extracted_data || {})
    setHasChanges(false)
  }, [document])

  // Get schema for this document type (see next section)
  const schema = getSchemaForDocType(docType)

  const handleFieldChange = (key, value) => {
    setEditedData(prev => ({
      ...prev,
      [key]: value
    }))
    setHasChanges(true)
  }

  const handleSave = () => {
    onSave(document.id, editedData)
    setHasChanges(false)
  }

  const handleApprove = () => {
    if (hasChanges) {
      onSave(document.id, editedData)
    }
    onApprove(document.id)
  }

  const renderField = (field) => {
    const value = editedData[field.key] ?? ''

    switch (field.type) {
      case 'text':
      case 'email':
      case 'date':
        return (
          <input
            type={field.type}
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
          />
        )

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            rows={4}
          />
        )

      case 'array':
        return <ArrayEditor value={value} onChange={(v) => handleFieldChange(field.key, v)} />

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
          />
        )
    }
  }

  return (
    <div className="review-editor">
      <div className="editor-content">
        {/* Document Preview Panel */}
        <div className="preview-panel">
          <h3>Document Preview</h3>
          {document.preview ? (
            <img src={document.preview} alt="Document" />
          ) : (
            <div className="no-preview">
              <p>{document.fileName}</p>
            </div>
          )}
        </div>

        {/* Editing Fields Panel */}
        <div className="fields-panel">
          <h3>Extracted Data</h3>
          {schema.map((field) => (
            <div key={field.key} className="field-group">
              <label>{field.label}</label>
              {renderField(field)}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="editor-footer">
        <button onClick={onDelete}>Delete</button>
        {hasChanges && <button onClick={handleSave}>Save Changes</button>}
        <button onClick={handleApprove}>
          {hasChanges ? 'Approve & Save' : 'Approve'}
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

export default ReviewEditor
```

---

## Document Type Configuration

### Understanding Schemas

The backend returns field names **exactly as specified** in `document_processing/config/doc_types.yaml`. These use **human-readable format with spaces and capitals** (e.g., `"Invoice Number"`, not `"invoice_number"`).

Your frontend schema must match these exact keys.

### Creating a Schema

Each document type needs a schema defining its fields:

```javascript
const DOCUMENT_SCHEMAS = {
  invoice: [
    { key: 'Invoice Number', label: 'Invoice Number', type: 'text' },
    { key: 'Invoice Date', label: 'Invoice Date', type: 'text' },
    { key: 'Due Date', label: 'Due Date', type: 'text' },
    { key: 'Vendor Name', label: 'Vendor Name', type: 'text' },
    { key: 'Vendor Address', label: 'Vendor Address', type: 'textarea' },
    { key: 'Customer Name', label: 'Customer Name', type: 'text' },
    { key: 'Customer Address', label: 'Customer Address', type: 'textarea' },
    { key: 'Total Amount Due', label: 'Total Amount Due', type: 'text' },
    { key: 'Line Items', label: 'Line Items', type: 'array' }
  ],

  receipt: [
    { key: 'Merchant Name', label: 'Merchant Name', type: 'text' },
    { key: 'Merchant Address', label: 'Merchant Address', type: 'textarea' },
    { key: 'Purchase Date', label: 'Purchase Date', type: 'text' },
    { key: 'Receipt Number or Transaction ID', label: 'Transaction ID', type: 'text' },
    { key: 'Payment Method', label: 'Payment Method', type: 'text' },
    { key: 'Total Paid', label: 'Total Paid', type: 'text' },
    { key: 'Itemized Purchases', label: 'Itemized Purchases', type: 'array' }
  ],

  w2: [
    { key: "Employee's Name", label: "Employee's Name", type: 'text' },
    { key: "Employee's Address", label: "Employee's Address", type: 'textarea' },
    { key: "Employer's Name", label: "Employer's Name", type: 'text' },
    { key: "Employer's Address", label: "Employer's Address", type: 'textarea' },
    { key: 'Employer Identification Number (EIN)', label: 'EIN', type: 'text' },
    { key: 'Wages, Tips, Other Compensation (Box 1)', label: 'Wages (Box 1)', type: 'text' },
    { key: 'Federal Income Tax Withheld (Box 2)', label: 'Federal Tax (Box 2)', type: 'text' },
    { key: 'Social Security Wages (Box 3)', label: 'SS Wages (Box 3)', type: 'text' },
    { key: 'Social Security Tax Withheld (Box 4)', label: 'SS Tax (Box 4)', type: 'text' },
    { key: 'Medicare Wages and Tips (Box 5)', label: 'Medicare Wages (Box 5)', type: 'text' },
    { key: 'Medicare Tax Withheld (Box 6)', label: 'Medicare Tax (Box 6)', type: 'text' }
  ],

  insurance_card: [
    { key: 'Policy Holder Name', label: 'Policy Holder Name', type: 'text' },
    { key: 'Policy Number', label: 'Policy Number', type: 'text' },
    { key: 'Group Number', label: 'Group Number', type: 'text' },
    { key: 'Insurance Company Name', label: 'Insurance Company', type: 'text' },
    { key: 'Effective Date', label: 'Effective Date', type: 'text' },
    { key: 'Expiration Date', label: 'Expiration Date', type: 'text' },
    { key: 'Contact Phone Number', label: 'Contact Phone', type: 'text' }
  ]
}

function getSchemaForDocType(docType) {
  return DOCUMENT_SCHEMAS[docType] || []
}
```

### Schema Field Types

| Type | Description | Use Case |
|------|-------------|----------|
| `text` | Single-line text input | Names, numbers, dates |
| `email` | Email input with validation | Email addresses |
| `date` | Date picker | Date fields |
| `textarea` | Multi-line text area | Addresses, descriptions |
| `array` | Array/table editor | Line items, purchases |

### Adding a New Document Type

**Step 1:** Check the backend schema in `document_processing/config/doc_types.yaml`

```yaml
purchase_order:
  description: "Purchase order document"
  instructions: |
    Extract the following information from the purchase order:
      - Purchase Order Number.
      - Purchase Order Date.
      - Buyer's Name and Address.
      - Seller's Name and Address.
      - List of Items Ordered: Each item should include description, quantity, unit price, and line total.
      - Subtotal.
      - Taxes.
      - Total Amount.
```

**Step 2:** Create matching frontend schema

```javascript
purchase_order: [
  { key: 'Purchase Order Number', label: 'PO Number', type: 'text' },
  { key: 'Purchase Order Date', label: 'PO Date', type: 'text' },
  { key: "Buyer's Name and Address", label: "Buyer's Info", type: 'textarea' },
  { key: "Seller's Name and Address", label: "Seller's Info", type: 'textarea' },
  { key: 'List of Items Ordered', label: 'Items Ordered', type: 'array' },
  { key: 'Subtotal', label: 'Subtotal', type: 'text' },
  { key: 'Taxes', label: 'Taxes', type: 'text' },
  { key: 'Total Amount', label: 'Total Amount', type: 'text' }
]
```

**Step 3:** Add to your page routing

```jsx
<Route path="/purchase-orders" element={
  <DocumentPage docType="purchase_order" />
} />
```

### ⚠️ Critical: Key Matching

The `key` field in your schema **MUST EXACTLY MATCH** the field names returned by the backend API. Pay attention to:
- Spaces: `"Invoice Number"` not `"InvoiceNumber"`
- Capitalization: `"Total Amount Due"` not `"total amount due"`
- Special characters: `"Employee's Name"` includes apostrophe
- Parentheses: `"Wages, Tips, Other Compensation (Box 1)"` includes full text

**To verify your schema:**
1. Process a test document
2. Check browser DevTools → Network → Response
3. Copy the exact field names from the `data` object
4. Use those exact strings as your schema `key` values

---

## Multi-Document Processing

### Batch Upload Component

Allow users to select and process multiple documents at once.

```jsx
import { useState } from 'react'
import axios from 'axios'

function BatchUpload({ docType, onAllComplete }) {
  const [files, setFiles] = useState([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState([])

  const handleFilesChange = (e) => {
    const selectedFiles = Array.from(e.target.files)

    // Filter valid files
    const validFiles = selectedFiles.filter(file => {
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
      return validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024
    })

    setFiles(validFiles)
    setProgress(validFiles.map(() => ({ status: 'pending', result: null })))
  }

  const processFiles = async () => {
    setProcessing(true)
    const results = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      try {
        // Update progress
        setProgress(prev => {
          const updated = [...prev]
          updated[i] = { status: 'processing', result: null }
          return updated
        })

        // Process file
        const formData = new FormData()
        formData.append('file', file)
        formData.append('use_agents', 'true')
        formData.append('refine', 'true')
        formData.append('return_text', 'false')

        if (docType) {
          formData.append('doc_type', docType)
        }

        const response = await axios.post('/api/classify-extract', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })

        const backendData = response.data
        const result = {
          id: Date.now() + i,
          document_type: backendData.classification?.type || 'unknown',
          confidence: backendData.classification?.confidence || 0,
          extracted_data: backendData.data || {},
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          status: 'pending',
          uploadedAt: new Date().toISOString()
        }

        results.push(result)

        // Update progress - success
        setProgress(prev => {
          const updated = [...prev]
          updated[i] = { status: 'completed', result }
          return updated
        })

      } catch (error) {
        // Update progress - error
        setProgress(prev => {
          const updated = [...prev]
          updated[i] = {
            status: 'error',
            error: error.response?.data?.detail || error.message
          }
          return updated
        })
      }
    }

    setProcessing(false)
    onAllComplete(results)
  }

  return (
    <div className="batch-upload">
      <input
        type="file"
        multiple
        onChange={handleFilesChange}
        accept=".pdf,.png,.jpg,.jpeg"
        disabled={processing}
      />

      {files.length > 0 && (
        <div className="file-list">
          <h3>Selected Files ({files.length})</h3>
          {files.map((file, index) => (
            <div key={index} className="file-item">
              <span>{file.name}</span>
              <span className={`status ${progress[index]?.status}`}>
                {progress[index]?.status || 'pending'}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={processFiles}
        disabled={files.length === 0 || processing}
      >
        {processing ? `Processing ${files.length} files...` : `Process ${files.length} Files`}
      </button>
    </div>
  )
}

export default BatchUpload
```

### Parallel Processing

For better performance, process multiple files in parallel:

```javascript
async function processFilesInParallel(files, docType, maxConcurrent = 3) {
  const results = []
  const queue = [...files]
  const inProgress = []

  const processFile = async (file, index) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('use_agents', 'true')
    formData.append('refine', 'true')
    formData.append('return_text', 'false')

    if (docType) {
      formData.append('doc_type', docType)
    }

    try {
      const response = await axios.post('/api/classify-extract', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      return {
        success: true,
        index,
        fileName: file.name,
        data: response.data
      }
    } catch (error) {
      return {
        success: false,
        index,
        fileName: file.name,
        error: error.message
      }
    }
  }

  while (queue.length > 0 || inProgress.length > 0) {
    // Start new tasks up to maxConcurrent
    while (inProgress.length < maxConcurrent && queue.length > 0) {
      const file = queue.shift()
      const index = files.indexOf(file)
      inProgress.push(processFile(file, index))
    }

    // Wait for at least one to complete
    const result = await Promise.race(inProgress)
    results[result.index] = result

    // Remove from in-progress
    const completedIndex = inProgress.findIndex(p => p === result)
    inProgress.splice(completedIndex, 1)
  }

  return results
}
```

### Progress Tracking

Display real-time progress for batch operations:

```jsx
function BatchProgress({ totalFiles, completedFiles, currentFile }) {
  const percentage = (completedFiles / totalFiles) * 100

  return (
    <div className="batch-progress">
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="progress-text">
        Processing {completedFiles} of {totalFiles} files
        {currentFile && <span> - Current: {currentFile}</span>}
      </div>
    </div>
  )
}
```

---

## Complete Implementation Examples

### Example 1: Simple Invoice Page

A dedicated page for invoice processing only.

```jsx
import { useState, useEffect } from 'react'
import DocumentUpload from './components/DocumentUpload'
import Dashboard from './components/Dashboard'
import ReviewEditor from './components/ReviewEditor'

function InvoicePage() {
  const [documents, setDocuments] = useState([])
  const [reviewingDoc, setReviewingDoc] = useState(null)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('invoiceDocuments')
    if (saved) {
      setDocuments(JSON.parse(saved))
    }
  }, [])

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('invoiceDocuments', JSON.stringify(documents))
  }, [documents])

  const handleUploadComplete = (newDoc) => {
    setDocuments(prev => [...prev, newDoc])
  }

  const handleSave = (docId, editedData) => {
    setDocuments(prev => prev.map(doc =>
      doc.id === docId
        ? { ...doc, extracted_data: editedData }
        : doc
    ))
  }

  const handleApprove = (docId) => {
    setDocuments(prev => prev.map(doc =>
      doc.id === docId
        ? { ...doc, status: 'approved' }
        : doc
    ))
    setReviewingDoc(null)
  }

  const handleDelete = (docId) => {
    setDocuments(prev => prev.filter(doc => doc.id !== docId))
    setReviewingDoc(null)
  }

  return (
    <div className="invoice-page">
      <h1>Invoice Processing</h1>

      <section className="upload-section">
        <DocumentUpload
          docType="invoice"
          onComplete={handleUploadComplete}
        />
      </section>

      <section className="dashboard-section">
        <Dashboard
          documents={documents}
          onReview={setReviewingDoc}
          onDelete={handleDelete}
          onApprove={handleApprove}
        />
      </section>

      {reviewingDoc && (
        <ReviewEditor
          document={reviewingDoc}
          docType="invoice"
          onClose={() => setReviewingDoc(null)}
          onSave={handleSave}
          onApprove={handleApprove}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

export default InvoicePage
```

### Example 2: Multi-Type Document Hub

A page that handles multiple document types with auto-classification.

```jsx
import { useState, useEffect } from 'react'
import DocumentUpload from './components/DocumentUpload'
import Dashboard from './components/Dashboard'
import ReviewEditor from './components/ReviewEditor'

function DocumentHub() {
  const [documents, setDocuments] = useState({
    invoice: [],
    receipt: [],
    w2: [],
    other: []
  })
  const [activeTab, setActiveTab] = useState('invoice')
  const [reviewingDoc, setReviewingDoc] = useState(null)

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('allDocuments')
    if (saved) {
      setDocuments(JSON.parse(saved))
    }
  }, [])

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('allDocuments', JSON.stringify(documents))
  }, [documents])

  const handleUploadComplete = (newDoc) => {
    const docType = newDoc.document_type || 'other'
    setDocuments(prev => ({
      ...prev,
      [docType]: [...(prev[docType] || []), newDoc]
    }))
    setActiveTab(docType)
  }

  const handleSave = (docId, editedData) => {
    setDocuments(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(type => {
        updated[type] = updated[type].map(doc =>
          doc.id === docId
            ? { ...doc, extracted_data: editedData }
            : doc
        )
      })
      return updated
    })
  }

  const handleApprove = (docId) => {
    setDocuments(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(type => {
        updated[type] = updated[type].map(doc =>
          doc.id === docId
            ? { ...doc, status: 'approved' }
            : doc
        )
      })
      return updated
    })
    setReviewingDoc(null)
  }

  const handleDelete = (docId) => {
    setDocuments(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(type => {
        updated[type] = updated[type].filter(doc => doc.id !== docId)
      })
      return updated
    })
    setReviewingDoc(null)
  }

  const activeDocuments = documents[activeTab] || []

  return (
    <div className="document-hub">
      <h1>Document Processing Hub</h1>

      <section className="upload-section">
        <DocumentUpload
          docType={null} // Auto-classify
          onComplete={handleUploadComplete}
        />
      </section>

      <nav className="doc-type-tabs">
        {Object.keys(documents).map(type => (
          <button
            key={type}
            className={activeTab === type ? 'active' : ''}
            onClick={() => setActiveTab(type)}
          >
            {type.replace(/_/g, ' ')}
            <span className="count">({documents[type]?.length || 0})</span>
          </button>
        ))}
      </nav>

      <section className="dashboard-section">
        <Dashboard
          documents={activeDocuments}
          onReview={setReviewingDoc}
          onDelete={handleDelete}
          onApprove={handleApprove}
        />
      </section>

      {reviewingDoc && (
        <ReviewEditor
          document={reviewingDoc}
          docType={reviewingDoc.document_type}
          onClose={() => setReviewingDoc(null)}
          onSave={handleSave}
          onApprove={handleApprove}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

export default DocumentHub
```

### Example 3: Batch Processing Page

Process multiple documents at once.

```jsx
import { useState } from 'react'
import BatchUpload from './components/BatchUpload'
import Dashboard from './components/Dashboard'
import ReviewEditor from './components/ReviewEditor'

function BatchProcessingPage() {
  const [documents, setDocuments] = useState([])
  const [reviewingDoc, setReviewingDoc] = useState(null)

  const handleBatchComplete = (results) => {
    setDocuments(prev => [...prev, ...results])
  }

  const handleSave = (docId, editedData) => {
    setDocuments(prev => prev.map(doc =>
      doc.id === docId
        ? { ...doc, extracted_data: editedData }
        : doc
    ))
  }

  const handleApprove = (docId) => {
    setDocuments(prev => prev.map(doc =>
      doc.id === docId
        ? { ...doc, status: 'approved' }
        : doc
    ))
    setReviewingDoc(null)
  }

  const handleDelete = (docId) => {
    setDocuments(prev => prev.filter(doc => doc.id !== docId))
    setReviewingDoc(null)
  }

  return (
    <div className="batch-page">
      <h1>Batch Document Processing</h1>

      <BatchUpload
        docType="invoice"
        onAllComplete={handleBatchComplete}
      />

      <Dashboard
        documents={documents}
        onReview={setReviewingDoc}
        onDelete={handleDelete}
        onApprove={handleApprove}
      />

      {reviewingDoc && (
        <ReviewEditor
          document={reviewingDoc}
          docType={reviewingDoc.document_type}
          onClose={() => setReviewingDoc(null)}
          onSave={handleSave}
          onApprove={handleApprove}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

export default BatchProcessingPage
```

---

## Troubleshooting

### Common Issues

**1. Empty extracted data**
- Check that schema `key` values exactly match backend field names
- Look at browser DevTools → Network → Response to see actual field names
- Backend uses spaces and capitals (e.g., "Invoice Number")

**2. CORS errors**
- Configure backend to allow your frontend origin
- Or use a proxy in development

**3. Files too large**
- Backend limits files to 10MB
- Compress large PDFs before upload
- Or implement chunked upload

**4. Slow processing**
- OCR + LLM processing takes 30-60 seconds per document
- Use batch processing with parallel requests
- Show progress indicators to users

**5. Low confidence scores**
- Poor image quality - ask users to upload clearer scans
- Wrong document type - verify `doc_type` parameter
- Missing data - some fields may be blank in original document

---

## Reference Files

For complete working examples, see these files in the UDP-Parser repository:

- **Upload Component**: `web-app/src/components/DocumentUploadSpecific.jsx`
- **Dashboard**: `web-app/src/components/PendingReviewList.jsx`
- **Review Editor**: `web-app/src/components/DocumentReviewEditor.jsx`
- **Array Table Editor**: Inside `DocumentReviewEditor.jsx` (lines 4-209)
- **Navigation**: `web-app/src/components/Navigation.jsx`
- **Backend Schema**: `document_processing/config/doc_types.yaml`

---

## Support

For issues or questions:
- Check backend logs: `docker logs -f doc-ai`
- Review API docs: `http://localhost:8080/docs`
- Inspect network requests in browser DevTools

---

**Version:** 1.0
**Last Updated:** 2025
**UDP Framework**
