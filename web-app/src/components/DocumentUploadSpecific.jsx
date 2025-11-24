import { useState, useRef } from 'react'
import axios from 'axios'
import './DocumentUploadSpecific.css'

function DocumentUploadSpecific({ docType, title, description, onProcessingComplete }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
      if (!validTypes.includes(selectedFile.type)) {
        setError('Please upload a PDF or image file (PNG, JPG, JPEG)')
        return
      }
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
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileChange({ target: { files: [droppedFile] } })
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
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
      formData.append('use_agents', 'true')
      formData.append('refine', 'true')
      formData.append('return_text', 'false')

      // If docType is specified, force that type, otherwise let it auto-classify
      if (docType) {
        formData.append('doc_type', docType)
      }

      const response = await axios.post('/api/classify-extract', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      // Transform backend response to frontend format
      const backendData = response.data
      const result = {
        document_type: backendData.classification?.type || 'unknown',
        confidence: backendData.classification?.confidence || 0,
        extracted_data: backendData.data || {},
        raw_text: backendData.raw_text || null,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        preview: preview
      }

      onProcessingComplete(result)

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

  const handleClearFile = () => {
    setFile(null)
    setPreview(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="upload-specific">
      <div className="upload-specific-header">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <form onSubmit={handleSubmit} className="upload-specific-form">
        <div
          className={`file-drop-zone ${file ? 'has-file' : ''} ${loading ? 'disabled' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.png,.jpg,.jpeg"
            disabled={loading}
            id="file-input-specific"
            style={{ display: 'none' }}
          />

          {!file ? (
            <label htmlFor="file-input-specific" className="file-input-label">
              <span className="upload-icon">⬆️</span>
              <span>Click to upload or drag and drop</span>
              <span className="file-types">PDF, PNG, JPG (max 10MB)</span>
            </label>
          ) : (
            <div className="file-preview-container">
              {preview && (
                <div className="image-preview">
                  <img src={preview} alt="Preview" />
                </div>
              )}
              <div className="file-info">
                <span className="file-icon">📄</span>
                <div className="file-details">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">
                    {(file.size / 1024).toFixed(2)} KB
                  </span>
                </div>
                {!loading && (
                  <button
                    type="button"
                    onClick={handleClearFile}
                    className="btn-clear"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="error-message">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={!file || loading} className="btn-submit-specific">
          {loading ? (
            <>
              <span className="spinner-small"></span>
              Processing...
            </>
          ) : (
            '🚀 Process Document'
          )}
        </button>
      </form>
    </div>
  )
}

export default DocumentUploadSpecific
