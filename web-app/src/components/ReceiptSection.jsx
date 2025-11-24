import { useState } from 'react'
import DocumentUploadSpecific from './DocumentUploadSpecific'
import PendingReviewList from './PendingReviewList'
import DocumentReviewEditor from './DocumentReviewEditor'
import './Section.css'

function ReceiptSection({ documents, onAddDocument, onUpdateDocument, onRemoveDocument, onApproveDocument }) {
  const [view, setView] = useState('upload')
  const [selectedDocument, setSelectedDocument] = useState(null)

  const pendingDocs = documents.filter(d => d.status === 'pending')
  const approvedDocs = documents.filter(d => d.status === 'approved')

  const handleDocumentProcessed = (result) => {
    onAddDocument({
      ...result,
      originalFile: null
    })
    setView('review')
  }

  const handleSelectDocument = (doc) => {
    setSelectedDocument(doc)
  }

  const handleCloseEditor = () => {
    setSelectedDocument(null)
  }

  const handleSaveDocument = (documentId, updatedData) => {
    onUpdateDocument(documentId, { extracted_data: updatedData })
    setSelectedDocument(null)
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <h2>🧾 Receipt Processing</h2>
        <div className="section-tabs">
          <button
            className={`tab-btn ${view === 'upload' ? 'active' : ''}`}
            onClick={() => setView('upload')}
          >
            📤 Upload
          </button>
          <button
            className={`tab-btn ${view === 'review' ? 'active' : ''}`}
            onClick={() => setView('review')}
          >
            📋 Review ({pendingDocs.length})
          </button>
        </div>
      </div>

      {view === 'upload' && (
        <DocumentUploadSpecific
          docType="receipt"
          title="Upload Receipt"
          description="Upload receipt documents for automatic data extraction"
          onProcessingComplete={handleDocumentProcessed}
        />
      )}

      {view === 'review' && !selectedDocument && (
        <PendingReviewList
          documents={pendingDocs}
          approvedDocuments={approvedDocs}
          docType="receipt"
          onSelectDocument={handleSelectDocument}
          onRemoveDocument={onRemoveDocument}
          onApproveDocument={onApproveDocument}
        />
      )}

      {selectedDocument && (
        <DocumentReviewEditor
          document={selectedDocument}
          docType="receipt"
          onClose={handleCloseEditor}
          onSave={handleSaveDocument}
          onApprove={() => {
            onApproveDocument(selectedDocument.id)
            handleCloseEditor()
          }}
          onReject={() => {
            onRemoveDocument(selectedDocument.id)
            handleCloseEditor()
          }}
        />
      )}
    </div>
  )
}

export default ReceiptSection
