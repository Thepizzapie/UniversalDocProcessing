import React, { useState } from 'react'
import './ResultsDisplay.css'

function ResultsDisplay({ result, onReset }) {
  const [activeTab, setActiveTab] = useState('formatted')

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return '#10b981' // green
    if (confidence >= 0.6) return '#f59e0b' // orange
    return '#ef4444' // red
  }

  const getDocumentTypeIcon = (docType) => {
    const icons = {
      invoice: '🧾',
      receipt: '🧾',
      insurance_card: '🏥',
      w2: '📋',
      resume: '📄',
      purchase_order: '📦',
      other: '📃'
    }
    return icons[docType] || '📃'
  }

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'N/A'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  const renderExtractedData = (data) => {
    if (!data || typeof data !== 'object') {
      return <p>No data extracted</p>
    }

    return (
      <div className="data-grid">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="data-item">
            <div className="data-label">
              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </div>
            <div className="data-value">
              {Array.isArray(value) ? (
                <div className="array-container">
                  {value.map((item, idx) => (
                    <div key={idx} className="array-item">
                      {typeof item === 'object' ? (
                        <pre>{JSON.stringify(item, null, 2)}</pre>
                      ) : (
                        formatValue(item)
                      )}
                    </div>
                  ))}
                </div>
              ) : typeof value === 'object' && value !== null ? (
                <pre>{JSON.stringify(value, null, 2)}</pre>
              ) : (
                formatValue(value)
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const downloadJSON = () => {
    const dataStr = JSON.stringify(result, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `document-${result.document_type}-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = () => {
    const dataStr = JSON.stringify(result, null, 2)
    navigator.clipboard.writeText(dataStr)
      .then(() => alert('Copied to clipboard!'))
      .catch(() => alert('Failed to copy'))
  }

  return (
    <div className="results-display">
      <div className="results-header">
        <h2>✅ Processing Complete!</h2>
        <div className="results-actions">
          <button onClick={downloadJSON} className="btn-action" title="Download JSON">
            💾 Download
          </button>
          <button onClick={copyToClipboard} className="btn-action" title="Copy to Clipboard">
            📋 Copy
          </button>
          <button onClick={onReset} className="btn-action btn-new">
            🔄 Process New Document
          </button>
        </div>
      </div>

      <div className="classification-summary">
        <div className="doc-type-badge">
          <span className="doc-icon">
            {getDocumentTypeIcon(result.document_type)}
          </span>
          <span className="doc-type-name">
            {result.document_type?.replace(/_/g, ' ').toUpperCase() || 'UNKNOWN'}
          </span>
        </div>
        <div className="confidence-meter">
          <div className="confidence-label">Confidence</div>
          <div className="confidence-bar">
            <div
              className="confidence-fill"
              style={{
                width: `${(result.confidence || 0) * 100}%`,
                backgroundColor: getConfidenceColor(result.confidence || 0)
              }}
            ></div>
          </div>
          <div className="confidence-value">
            {((result.confidence || 0) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="results-tabs">
        <button
          className={`tab-btn ${activeTab === 'formatted' ? 'active' : ''}`}
          onClick={() => setActiveTab('formatted')}
        >
          📊 Formatted View
        </button>
        <button
          className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
          onClick={() => setActiveTab('json')}
        >
          💻 JSON View
        </button>
        {result.raw_text && (
          <button
            className={`tab-btn ${activeTab === 'raw' ? 'active' : ''}`}
            onClick={() => setActiveTab('raw')}
          >
            📝 Raw OCR Text
          </button>
        )}
      </div>

      <div className="results-content">
        {activeTab === 'formatted' && (
          <div className="formatted-view">
            <h3>Extracted Data</h3>
            {renderExtractedData(result.extracted_data)}
          </div>
        )}

        {activeTab === 'json' && (
          <div className="json-view">
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}

        {activeTab === 'raw' && result.raw_text && (
          <div className="raw-view">
            <pre>{result.raw_text}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default ResultsDisplay
