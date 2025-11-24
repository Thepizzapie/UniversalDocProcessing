import { useState } from 'react'
import DocumentUploadSpecific from './DocumentUploadSpecific'
import PendingReviewList from './PendingReviewList'
import DocumentReviewEditor from './DocumentReviewEditor'
import './Section.css'

function InvoiceSection({ documents, onAddDocument, onUpdateDocument, onRemoveDocument, onApproveDocument }) {
  const [view, setView] = useState('upload') // 'upload' or 'review'
  const [selectedDocument, setSelectedDocument] = useState(null)

  const pendingDocs = documents.filter(d => d.status === 'pending')
  const approvedDocs = documents.filter(d => d.status === 'approved')

  const handleDocumentProcessed = (result) => {
    onAddDocument({
      ...result,
      originalFile: null // Don't store large file data
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
        <h2>🧾 Invoice Processing</h2>
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
          docType="invoice"
          title="Upload Invoice"
          description="Upload invoice documents for automatic data extraction"
          onProcessingComplete={handleDocumentProcessed}
        />
      )}

      {view === 'review' && !selectedDocument && (
        <PendingReviewList
          documents={pendingDocs}
          approvedDocuments={approvedDocs}
          docType="invoice"
          onSelectDocument={handleSelectDocument}
          onRemoveDocument={onRemoveDocument}
          onApproveDocument={onApproveDocument}
        />
      )}

      {selectedDocument && (
        <DocumentReviewEditor
          document={selectedDocument}
          docType="invoice"
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

export default InvoiceSection
