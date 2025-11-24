import { useState } from 'react'
import DocumentUploadSpecific from './DocumentUploadSpecific'
import PendingReviewList from './PendingReviewList'
import DocumentReviewEditor from './DocumentReviewEditor'
import './Section.css'

function OtherSection({ documents, onAddDocument, onUpdateDocument, onRemoveDocument, onApproveDocument }) {
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
        <h2>📄 Other Documents (Auto-Classify)</h2>
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
          docType={null} // null means auto-classify
          title="Upload Any Document"
          description="Upload any document type - AI will automatically classify and extract data"
          onProcessingComplete={handleDocumentProcessed}
        />
      )}

      {view === 'review' && !selectedDocument && (
        <PendingReviewList
          documents={pendingDocs}
          approvedDocuments={approvedDocs}
          docType="other"
          onSelectDocument={handleSelectDocument}
          onRemoveDocument={onRemoveDocument}
          onApproveDocument={onApproveDocument}
        />
      )}

      {selectedDocument && (
        <DocumentReviewEditor
          document={selectedDocument}
          docType={selectedDocument.document_type || 'other'}
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

export default OtherSection
