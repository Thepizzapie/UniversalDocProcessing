import React, { useState, useRef } from 'react'
import axios from 'axios'
import './DocumentUpload.css'

const DOCUMENT_TYPES = [
  { value: '', label: 'Auto-detect' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'insurance_card', label: 'Insurance Card' },
  { value: 'w2', label: 'W-2 Form' },
  { value: 'resume', label: 'Resume/CV' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'other', label: 'Other' }
]

function DocumentUpload({ onProcessingStart, onProcessingComplete, onError, disabled }) {
  const [file, setFile] = useState(null)
  const [fileUrl, setFileUrl] = useState('')
  const [uploadMode, setUploadMode] = useState('file') // 'file' or 'url'
  const [options, setOptions] = useState({
    useAgents: true,
    useRefinement: true,
    includeRawText: false,
    forcedDocType: ''
  })
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      // Validate file type
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
      if (!validTypes.includes(selectedFile.type)) {
        onError('Please upload a PDF or image file (PNG, JPG, JPEG)')
        return
      }
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        onError('File size must be less than 10MB')
        return
      }
      setFile(selectedFile)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (disabled) return

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      // Create a fake event object to reuse handleFileChange
      handleFileChange({ target: { files: [droppedFile] } })
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (uploadMode === 'file' && !file) {
      onError('Please select a file to upload')
      return
    }

    if (uploadMode === 'url' && !fileUrl) {
      onError('Please enter a file URL')
      return
    }

    onProcessingStart()

    try {
      let response

      if (uploadMode === 'file') {
        // File upload
        const formData = new FormData()
        formData.append('file', file)
        formData.append('use_agents', options.useAgents)
        formData.append('use_refinement', options.useRefinement)
        formData.append('include_raw_text', options.includeRawText)
        if (options.forcedDocType) {
          formData.append('forced_doc_type', options.forcedDocType)
        }

        response = await axios.post('/api/classify-extract', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
      } else {
        // URL upload
        const payload = {
          file_url: fileUrl,
          use_agents: options.useAgents,
          use_refinement: options.useRefinement,
          include_raw_text: options.includeRawText
        }
        if (options.forcedDocType) {
          payload.forced_doc_type = options.forcedDocType
        }

        response = await axios.post('/api/classify-extract', payload, {
          headers: {
            'Content-Type': 'application/json'
          }
        })
      }

      onProcessingComplete(response.data)

      // Reset form
      setFile(null)
      setFileUrl('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to process document'
      onError(errorMsg)
    }
  }

  return (
    <div className="document-upload">
      <div className="upload-mode-selector">
        <button
          className={`mode-btn ${uploadMode === 'file' ? 'active' : ''}`}
          onClick={() => setUploadMode('file')}
          disabled={disabled}
        >
          📁 Upload File
        </button>
        <button
          className={`mode-btn ${uploadMode === 'url' ? 'active' : ''}`}
          onClick={() => setUploadMode('url')}
          disabled={disabled}
        >
          🔗 From URL
        </button>
      </div>

      <form onSubmit={handleSubmit} className="upload-form">
        {uploadMode === 'file' ? (
          <div
            className={`file-drop-zone ${file ? 'has-file' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.png,.jpg,.jpeg"
              disabled={disabled}
              id="file-input"
              style={{ display: 'none' }}
            />
            <label htmlFor="file-input" className="file-input-label">
              {file ? (
                <>
                  <span className="file-icon">📄</span>
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">
                    ({(file.size / 1024).toFixed(2)} KB)
                  </span>
                </>
              ) : (
                <>
                  <span className="upload-icon">⬆️</span>
                  <span>Click to upload or drag and drop</span>
                  <span className="file-types">PDF, PNG, JPG (max 10MB)</span>
                </>
              )}
            </label>
          </div>
        ) : (
          <div className="url-input-container">
            <label htmlFor="file-url">Document URL:</label>
            <input
              type="url"
              id="file-url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://example.com/document.pdf"
              disabled={disabled}
              className="url-input"
            />
          </div>
        )}

        <div className="options-container">
          <h3>Processing Options</h3>

          <div className="option-group">
            <label>
              <input
                type="checkbox"
                checked={options.useAgents}
                onChange={(e) => setOptions({ ...options, useAgents: e.target.checked })}
                disabled={disabled}
              />
              <span>Use AI Agents (more accurate, slower)</span>
            </label>
          </div>

          <div className="option-group">
            <label>
              <input
                type="checkbox"
                checked={options.useRefinement}
                onChange={(e) => setOptions({ ...options, useRefinement: e.target.checked })}
                disabled={disabled}
              />
              <span>Use Refinement (validate and improve results)</span>
            </label>
          </div>

          <div className="option-group">
            <label>
              <input
                type="checkbox"
                checked={options.includeRawText}
                onChange={(e) => setOptions({ ...options, includeRawText: e.target.checked })}
                disabled={disabled}
              />
              <span>Include Raw OCR Text</span>
            </label>
          </div>

          <div className="option-group">
            <label htmlFor="doc-type">Force Document Type:</label>
            <select
              id="doc-type"
              value={options.forcedDocType}
              onChange={(e) => setOptions({ ...options, forcedDocType: e.target.value })}
              disabled={disabled}
              className="doc-type-select"
            >
              {DOCUMENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button type="submit" disabled={disabled} className="btn-submit">
          {disabled ? 'Processing...' : '🚀 Process Document'}
        </button>
      </form>
    </div>
  )
}

export default DocumentUpload
