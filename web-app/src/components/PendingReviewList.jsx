import { useState } from 'react'
import './PendingReviewList.css'

function PendingReviewList({ documents, approvedDocuments, docType, onSelectDocument, onRemoveDocument, onApproveDocument }) {
  const [showApproved, setShowApproved] = useState(false)

  const formatDate = (isoString) => {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDocumentTitle = (doc) => {
    const data = doc.extracted_data || {}

    // Try to get a meaningful title based on document type
    if (docType === 'invoice') {
      return data.invoice_number || `Invoice #${doc.id.toString().slice(0, 8)}`
    } else if (docType === 'receipt') {
      return data.merchant_name || `Receipt #${doc.id.toString().slice(0, 8)}`
    } else {
      return doc.document_type?.toUpperCase() || 'Document'
    }
  }

  const getDocumentSubtitle = (doc) => {
    const data = doc.extracted_data || {}

    if (docType === 'invoice') {
      return `${data.vendor_name || 'Unknown Vendor'} • ${data.total_amount || 'N/A'}`
    } else if (docType === 'receipt') {
      return `${data.date || 'No date'} • ${data.total || 'N/A'}`
    } else {
      return doc.fileName || 'Document'
    }
  }

  const displayDocuments = showApproved ? approvedDocuments : documents

  return (
    <div className="pending-review-list">
      <div className="list-header">
        <h3>
          {showApproved ? '✅ Approved Documents' : '📋 Pending Review'}
          <span className="count-badge">{displayDocuments.length}</span>
        </h3>
        <div className="view-toggle">
          <button
            className={`toggle-btn ${!showApproved ? 'active' : ''}`}
            onClick={() => setShowApproved(false)}
          >
            Pending ({documents.length})
          </button>
          <button
            className={`toggle-btn ${showApproved ? 'active' : ''}`}
            onClick={() => setShowApproved(true)}
          >
            Approved ({approvedDocuments.length})
          </button>
        </div>
      </div>

      {displayDocuments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            {showApproved ? '✅' : '📋'}
          </div>
          <h4>
            {showApproved ? 'No Approved Documents' : 'No Pending Documents'}
          </h4>
          <p>
            {showApproved
              ? 'Approved documents will appear here'
              : 'Upload documents to see them here for review'}
          </p>
        </div>
      ) : (
        <div className="document-grid">
          {displayDocuments.map((doc) => (
            <div key={doc.id} className="document-card">
              <div className="card-header">
                <div className="card-title">
                  <h4>{getDocumentTitle(doc)}</h4>
                  <p>{getDocumentSubtitle(doc)}</p>
                </div>
                {doc.confidence && (
                  <div className="confidence-badge">
                    {(doc.confidence * 100).toFixed(0)}%
                  </div>
                )}
              </div>

              <div className="card-meta">
                <span className="meta-item">
                  📅 {formatDate(doc.timestamp)}
                </span>
                {doc.fileName && (
                  <span className="meta-item">
                    📄 {doc.fileName}
                  </span>
                )}
              </div>

              <div className="card-actions">
                <button
                  className="btn-card btn-review"
                  onClick={() => onSelectDocument(doc)}
                >
                  👁️ Review
                </button>
                {!showApproved ? (
                  <>
                    <button
                      className="btn-card btn-approve"
                      onClick={() => onApproveDocument(doc.id)}
                    >
                      ✓ Approve
                    </button>
                    <button
                      className="btn-card btn-delete"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this document?')) {
                          onRemoveDocument(doc.id)
                        }
                      }}
                    >
                      🗑️
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-card btn-delete"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this approved document?')) {
                        onRemoveDocument(doc.id)
                      }
                    }}
                  >
                    🗑️ Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PendingReviewList
