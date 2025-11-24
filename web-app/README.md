# Doc AI Web App - Enhanced Edition

A modern React web application for the UDP - Parser (Doc AI) framework with dedicated sections for invoice, receipt, and general document processing. Features include document upload, AI-powered extraction, pending review queues, and an interactive document editor with preview.

![Doc AI Web App](https://img.shields.io/badge/React-18.2.0-blue)
![Vite](https://img.shields.io/badge/Vite-5.0.0-purple)

## 🎯 New Features

### Three Specialized Sections
- **📄 Invoice Processing** - Dedicated section for invoice uploads with custom schema
- **🧾 Receipt Processing** - Receipt-specific extraction and review
- **📋 Other Documents** - Auto-classification for any document type

### Document Review Workflow
- **Pending Queue** - All uploaded documents await review before approval
- **Side-by-Side Editor** - Edit extracted data while viewing the document
- **Document Preview** - View document images alongside extracted data
- **Field-Level Editing** - Edit each extracted field with type-appropriate inputs
- **Approve/Reject** - Review and approve documents or reject for reprocessing
- **Local Persistence** - All documents saved in browser localStorage

### Advanced Extraction
- **Schema-Based Editing** - Each document type has its own extraction schema
- **Live Field Updates** - Edit fields in real-time with instant validation
- **Array Support** - Edit complex fields like line items and lists
- **Raw OCR Access** - View original OCR text for verification

## 📊 Supported Document Types & Schemas

### Invoice
- Invoice number, dates, vendor/customer info
- Line items, subtotal, tax, total
- Custom notes and payment terms

### Receipt
- Merchant name and address
- Transaction ID, date/time
- Items, subtotal, tax, tip, total
- Payment method

### Insurance Card
- Member information
- Plan and group numbers
- Effective dates, copay

### W-2 Form
- Employee and employer info
- Wages and tax withholdings
- Social Security and Medicare

### Resume/CV
- Contact information
- Professional summary
- Experience, education, skills

### Purchase Order
- PO number, vendor info
- Ship-to and bill-to addresses
- Items and totals

### Auto-Classified Documents
- Any document type supported by the backend

## 🚀 Quick Start

### 1. Start the UDP - Parser API

```bash
cd "d:\UDP - Parser"

# Using Docker
docker build -t doc-ai .
docker run -d -p 8080:8080 -e OPENAI_API_KEY=your_key_here --name doc-ai doc-ai

# Check if running
docker logs doc-ai
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8080
```

### 2. Start the Web App

```bash
cd "d:\UDP - Parser\web-app"

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

The app will be available at **http://localhost:3000**

## 💡 How to Use

### Uploading Documents

1. **Select a Section**
   - Click **Invoices** for invoice processing
   - Click **Receipts** for receipt processing
   - Click **Other Documents** for auto-classification

2. **Upload a Document**
   - Drag and drop a file, or click to browse
   - Supported formats: PDF, PNG, JPG (max 10MB)
   - Document is automatically processed using AI

3. **View Pending Documents**
   - Click the **Review** tab to see all pending documents
   - Badge shows count of documents awaiting review

### Reviewing Documents

1. **Select a Document**
   - Click **👁️ Review** on any document card
   - Document opens in the review editor

2. **Review and Edit**
   - **Left Panel**: View document preview or raw OCR text
   - **Right Panel**: Edit extracted fields
   - All fields are editable based on their type

3. **Take Action**
   - **💾 Save Changes**: Save edits without approving
   - **✓ Approve**: Approve document (saves automatically)
   - **🗑️ Delete**: Remove document from queue

4. **View Approved**
   - Toggle to **Approved** view to see completed documents
   - Approved documents remain accessible for reference

### Field Types

The editor supports multiple field types:

- **Text**: Single-line text input
- **Textarea**: Multi-line text for addresses, notes
- **Number**: Numeric values with decimal support
- **Date**: Date picker for date fields
- **Email**: Email validation
- **Array**: JSON arrays for line items, lists

### Document Preview

- **Images**: Full preview of uploaded image documents
- **PDFs**: Displays file info (preview requires conversion)
- **Raw OCR**: Expandable section to view original extracted text

## 🏗️ Project Structure

```
web-app/
├── src/
│   ├── components/
│   │   ├── Navigation.jsx              # Top navigation with badges
│   │   ├── Navigation.css
│   │   │
│   │   ├── InvoiceSection.jsx          # Invoice processing section
│   │   ├── ReceiptSection.jsx          # Receipt processing section
│   │   ├── OtherSection.jsx            # Auto-classify section
│   │   ├── Section.css
│   │   │
│   │   ├── DocumentUploadSpecific.jsx  # Upload component with preview
│   │   ├── DocumentUploadSpecific.css
│   │   │
│   │   ├── PendingReviewList.jsx       # Document queue display
│   │   ├── PendingReviewList.css
│   │   │
│   │   ├── DocumentReviewEditor.jsx    # Full-screen editor with preview
│   │   └── DocumentReviewEditor.css
│   │
│   ├── App.jsx                          # Main app with state management
│   ├── App.css
│   ├── main.jsx                         # Entry point
│   └── index.css                        # Global styles
│
├── index.html
├── vite.config.js                       # Vite config with API proxy
├── package.json
└── README.md
```

## 🔧 Configuration

### API Endpoint

The app proxies API requests through Vite. To change the backend URL:

Edit [vite.config.js](vite.config.js):
```javascript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://your-api-host:port',  // Change this
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
```

### Data Persistence

Documents are stored in browser `localStorage`:
- Persists across page refreshes
- Separate queues for each document type
- Clear data: `localStorage.removeItem('pendingDocuments')`

### Document Schemas

To add or modify extraction schemas, edit [DocumentReviewEditor.jsx](src/components/DocumentReviewEditor.jsx):

```javascript
const DOCUMENT_SCHEMAS = {
  your_doc_type: [
    { key: 'field_name', label: 'Display Label', type: 'text' },
    // Add more fields...
  ]
}
```

Supported field types: `text`, `email`, `date`, `number`, `textarea`, `array`

## 🎨 Customization

### Styling

The app uses CSS variables for easy theming. Edit [src/index.css](src/index.css):

```css
:root {
  --primary-color: #3b82f6;
  --success-color: #10b981;
  --error-color: #ef4444;
  --warning-color: #f59e0b;
  /* ... more variables */
}
```

### Adding New Document Types

1. **Add Section Component** (optional):
   ```javascript
   // src/components/YourSection.jsx
   function YourSection({ documents, onAddDocument, ... }) {
     // Similar to InvoiceSection.jsx
   }
   ```

2. **Add Schema**:
   ```javascript
   // In DocumentReviewEditor.jsx
   const DOCUMENT_SCHEMAS = {
     your_type: [
       { key: 'field1', label: 'Field 1', type: 'text' },
       // ...
     ]
   }
   ```

3. **Update App**:
   ```javascript
   // In App.jsx, add to state and render logic
   ```

## 📦 Building for Production

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

Deploy the `dist/` directory to any static hosting:
- Netlify
- Vercel
- GitHub Pages
- AWS S3 + CloudFront
- Any web server

## 🐛 Troubleshooting

### API Not Responding

**Problem**: Documents fail to process

**Solution**:
1. Check API is running: `curl http://localhost:8080`
2. Check Docker logs: `docker logs doc-ai`
3. Verify OPENAI_API_KEY is set correctly

### Documents Not Persisting

**Problem**: Documents disappear after refresh

**Solution**:
1. Check browser localStorage is enabled
2. Check for browser errors in console (F12)
3. Clear and retry: `localStorage.clear()`

### Preview Not Showing

**Problem**: Document preview is blank

**Solution**:
- PDFs don't show previews (by design, only images)
- Check file was uploaded correctly
- Verify image file format (PNG, JPG, JPEG only)

### Schema Fields Missing

**Problem**: Some fields don't appear in editor

**Solution**:
1. Check document type matches schema
2. Verify schema definition in DocumentReviewEditor.jsx
3. Check backend returned correct document_type

## 🔄 Workflow Example

```
1. User uploads invoice.pdf to Invoice section
   ↓
2. Backend processes with AI
   ↓
3. Document appears in "Review (1)" tab
   ↓
4. User clicks "Review" button
   ↓
5. Split-screen editor opens:
   - Left: Document preview
   - Right: Editable fields
   ↓
6. User reviews and edits fields
   ↓
7. User clicks "Approve"
   ↓
8. Document moves to "Approved" list
   ↓
9. Data persists in localStorage
```

## 🌟 Key Benefits

1. **Organized Workflow**: Separate sections keep documents organized
2. **Quality Control**: Review queue ensures accuracy before approval
3. **Visual Verification**: Side-by-side view enables easy validation
4. **Persistent Storage**: No data loss on page refresh
5. **Type Safety**: Schema-based fields prevent data entry errors
6. **Flexible**: Works with any document type supported by backend

## 🚧 Known Limitations

- **Frontend Only**: No backend changes allowed (per requirements)
- **localStorage Limit**: ~5-10MB per domain (thousands of documents)
- **PDF Preview**: PDFs show file info only, not rendered preview
- **No Auth**: No user authentication (single-user local use)
- **No Export to Backend**: Documents only saved locally

## 📚 Technologies Used

- **React 18.2** - UI library
- **Vite 5.0** - Build tool and dev server
- **Axios** - HTTP client for API calls
- **CSS3** - Modern styling with variables and grid
- **localStorage API** - Client-side data persistence

## 🤝 Contributing

This is part of the UDP - Parser project. See main [README](../README.md) for contribution guidelines.

## 📄 License

MIT License - See [LICENSE](../LICENSE) in project root

---

**Happy Document Processing! 🎉**

For issues or questions about the UDP - Parser backend, see the main project documentation.
