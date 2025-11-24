import { useState, useEffect } from 'react'
import './DocumentReviewEditor.css'

// Array Table Editor Component
function ArrayTableEditor({ value, field, onChange }) {
  const [items, setItems] = useState([])
  const [rawMode, setRawMode] = useState(false)
  const [rawText, setRawText] = useState('')

  useEffect(() => {
    if (Array.isArray(value)) {
      setItems(value)
      setRawText(JSON.stringify(value, null, 2))
    } else if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) {
          setItems(parsed)
          setRawText(value)
        } else {
          setItems([])
          setRawText(value)
        }
      } catch {
        setItems([])
        setRawText(value)
      }
    } else {
      setItems([])
      setRawText('[]')
    }
  }, [value])

  const handleAddRow = () => {
    const newItem = typeof items[0] === 'object' && items[0] !== null
      ? { ...items[0], ...Object.fromEntries(Object.keys(items[0]).map(k => [k, ''])) }
      : {}
    const newItems = [...items, newItem]
    setItems(newItems)
    onChange(newItems)
  }

  const handleDeleteRow = (index) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
    onChange(newItems)
  }

  const handleCellChange = (rowIndex, key, cellValue) => {
    const newItems = [...items]
    if (typeof newItems[rowIndex] === 'object') {
      newItems[rowIndex] = { ...newItems[rowIndex], [key]: cellValue }
    } else {
      newItems[rowIndex] = cellValue
    }
    setItems(newItems)
    onChange(newItems)
  }

  const handleRawTextChange = (text) => {
    setRawText(text)
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        setItems(parsed)
        onChange(parsed)
      }
    } catch {
      // Invalid JSON, don't update items
    }
  }

  const toggleMode = () => {
    if (!rawMode) {
      setRawText(JSON.stringify(items, null, 2))
    }
    setRawMode(!rawMode)
  }

  if (rawMode) {
    return (
      <div className="array-editor">
        <div className="array-editor-header">
          <button type="button" className="btn-toggle-mode" onClick={toggleMode}>
            📊 Table View
          </button>
        </div>
        <textarea
          value={rawText}
          onChange={(e) => handleRawTextChange(e.target.value)}
          className="field-textarea array-raw-textarea"
          rows={8}
        />
        <span className="field-hint">JSON array format</span>
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div className="array-editor">
        <div className="array-editor-header">
          <button type="button" className="btn-toggle-mode" onClick={toggleMode}>
            📝 Raw JSON
          </button>
        </div>
        <div className="array-empty">
          <p>No items</p>
          <button type="button" className="btn-add-row" onClick={handleAddRow}>
            + Add Item
          </button>
        </div>
      </div>
    )
  }

  // Detect if items are objects or primitives
  const firstItem = items[0]
  const isObjectArray = typeof firstItem === 'object' && firstItem !== null

  if (isObjectArray) {
    const columns = Object.keys(firstItem)

    return (
      <div className="array-editor">
        <div className="array-editor-header">
          <button type="button" className="btn-toggle-mode" onClick={toggleMode}>
            📝 Raw JSON
          </button>
          <button type="button" className="btn-add-row" onClick={handleAddRow}>
            + Add Row
          </button>
        </div>
        <div className="array-table-container">
          <table className="array-table">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col}>{col}</th>
                ))}
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map(col => (
                    <td key={col}>
                      <input
                        type="text"
                        value={item[col] ?? ''}
                        onChange={(e) => handleCellChange(rowIndex, col, e.target.value)}
                        className="array-cell-input"
                      />
                    </td>
                  ))}
                  <td className="col-actions">
                    <button
                      type="button"
                      className="btn-delete-row"
                      onClick={() => handleDeleteRow(rowIndex)}
                      title="Delete row"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  } else {
    // Simple array of primitives
    return (
      <div className="array-editor">
        <div className="array-editor-header">
          <button type="button" className="btn-toggle-mode" onClick={toggleMode}>
            📝 Raw JSON
          </button>
          <button type="button" className="btn-add-row" onClick={handleAddRow}>
            + Add Item
          </button>
        </div>
        <div className="array-simple-list">
          {items.map((item, index) => (
            <div key={index} className="array-simple-row">
              <input
                type="text"
                value={item}
                onChange={(e) => handleCellChange(index, null, e.target.value)}
                className="array-simple-input"
              />
              <button
                type="button"
                className="btn-delete-row"
                onClick={() => handleDeleteRow(index)}
                title="Delete item"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }
}

// Schema definitions for each document type
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
  insurance_card: [
    { key: 'Policy Holder Name', label: 'Policy Holder Name', type: 'text' },
    { key: 'Policy Number', label: 'Policy Number', type: 'text' },
    { key: 'Group Number', label: 'Group Number', type: 'text' },
    { key: 'Insurance Company Name', label: 'Insurance Company', type: 'text' },
    { key: 'Effective Date', label: 'Effective Date', type: 'text' },
    { key: 'Expiration Date', label: 'Expiration Date', type: 'text' },
    { key: 'Contact Phone Number', label: 'Contact Phone', type: 'text' }
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
    { key: 'Medicare Tax Withheld (Box 6)', label: 'Medicare Tax (Box 6)', type: 'text' },
    { key: 'State Wages, Tips, Etc. (Box 16)', label: 'State Wages (Box 16)', type: 'text' },
    { key: 'State Income Tax (Box 17)', label: 'State Tax (Box 17)', type: 'text' }
  ],
  resume: [
    { key: 'Name', label: 'Candidate Name', type: 'text' },
    { key: 'Contact Information', label: 'Contact Information', type: 'textarea' },
    { key: 'Summary', label: 'Summary/Objective', type: 'textarea' },
    { key: 'Education', label: 'Education', type: 'array' },
    { key: 'Work Experience', label: 'Work Experience', type: 'array' },
    { key: 'Certifications', label: 'Certifications/Licenses', type: 'array' },
    { key: 'Skills', label: 'Skills', type: 'array' }
  ],
  purchase_order: [
    { key: 'Purchase Order Number', label: 'PO Number', type: 'text' },
    { key: 'Purchase Order Date', label: 'PO Date', type: 'text' },
    { key: "Buyer's Name and Address", label: "Buyer's Info", type: 'textarea' },
    { key: "Seller's Name and Address", label: "Seller's Info", type: 'textarea' },
    { key: 'List of Items Ordered', label: 'Items Ordered', type: 'array' },
    { key: 'Subtotal', label: 'Subtotal', type: 'text' },
    { key: 'Taxes', label: 'Taxes', type: 'text' },
    { key: 'Total Amount', label: 'Total Amount', type: 'text' }
  ],
  other: [
    { key: 'raw_text', label: 'Extracted Text', type: 'textarea' }
  ]
}

function DocumentReviewEditor({ document, docType, onClose, onSave, onApprove, onReject }) {
  const [editedData, setEditedData] = useState({})
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setEditedData(document.extracted_data || {})
    setHasChanges(false)
  }, [document])

  const schema = DOCUMENT_SCHEMAS[docType] || DOCUMENT_SCHEMAS.other

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
    onApprove()
  }

  const renderField = (field) => {
    const value = editedData[field.key] ?? ''

    switch (field.type) {
      case 'text':
      case 'email':
      case 'date':
      case 'number':
        return (
          <input
            type={field.type}
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="field-input"
            step={field.type === 'number' ? '0.01' : undefined}
          />
        )

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="field-textarea"
            rows={4}
          />
        )

      case 'array':
        return <ArrayTableEditor value={value} field={field} onChange={(newValue) => handleFieldChange(field.key, newValue)} />

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="field-input"
          />
        )
    }
  }

  return (
    <div className="document-review-editor">
      <div className="editor-overlay" onClick={onClose}></div>

      <div className="editor-container">
        <div className="editor-header">
          <div className="header-title">
            <h2>Review & Edit Document</h2>
            <div className="document-info">
              <span className="doc-type-badge">
                {docType.replace(/_/g, ' ').toUpperCase()}
              </span>
              {document.confidence && (
                <span className="confidence-badge">
                  {(document.confidence * 100).toFixed(0)}% confidence
                </span>
              )}
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="editor-content">
          {/* Document Preview */}
          <div className="preview-panel">
            <h3>Document Preview</h3>
            {document.preview ? (
              <div className="preview-image-container">
                <img src={document.preview} alt="Document" className="preview-image" />
              </div>
            ) : (
              <div className="no-preview">
                <span className="no-preview-icon">📄</span>
                <p>{document.fileName || 'No preview available'}</p>
                <span className="file-type">{document.fileType || 'PDF'}</span>
              </div>
            )}

            {document.raw_text && (
              <details className="raw-text-details">
                <summary>View Raw OCR Text</summary>
                <pre className="raw-text">{document.raw_text}</pre>
              </details>
            )}
          </div>

          {/* Editing Fields */}
          <div className="fields-panel">
            <h3>Extracted Data</h3>
            <div className="fields-container">
              {schema.map((field) => (
                <div key={field.key} className="field-group">
                  <label className="field-label">{field.label}</label>
                  {renderField(field)}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="editor-footer">
          <div className="footer-left">
            <button className="btn-footer btn-reject" onClick={onReject}>
              🗑️ Delete
            </button>
          </div>
          <div className="footer-right">
            {hasChanges && (
              <button className="btn-footer btn-save" onClick={handleSave}>
                💾 Save Changes
              </button>
            )}
            <button className="btn-footer btn-approve" onClick={handleApprove}>
              ✓ Approve {hasChanges && '& Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DocumentReviewEditor
