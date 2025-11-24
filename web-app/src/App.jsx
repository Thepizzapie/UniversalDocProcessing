import React, { useState, useEffect } from 'react'
import Navigation from './components/Navigation'
import InvoiceSection from './components/InvoiceSection'
import ReceiptSection from './components/ReceiptSection'
import OtherSection from './components/OtherSection'
import './App.css'

function App() {
  const [activeSection, setActiveSection] = useState('invoice')
  const [pendingDocuments, setPendingDocuments] = useState({
    invoice: [],
    receipt: [],
    other: []
  })

  // Load pending documents from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('pendingDocuments')
    if (saved) {
      try {
        setPendingDocuments(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to load saved documents:', e)
      }
    }
  }, [])

  // Save pending documents to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('pendingDocuments', JSON.stringify(pendingDocuments))
  }, [pendingDocuments])

  const addPendingDocument = (docType, document) => {
    setPendingDocuments(prev => ({
      ...prev,
      [docType]: [...prev[docType], {
        ...document,
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        status: 'pending'
      }]
    }))
  }

  const updateDocument = (docType, documentId, updates) => {
    setPendingDocuments(prev => ({
      ...prev,
      [docType]: prev[docType].map(doc =>
        doc.id === documentId ? { ...doc, ...updates } : doc
      )
    }))
  }

  const removeDocument = (docType, documentId) => {
    setPendingDocuments(prev => ({
      ...prev,
      [docType]: prev[docType].filter(doc => doc.id !== documentId)
    }))
  }

  const approveDocument = (docType, documentId) => {
    updateDocument(docType, documentId, {
      status: 'approved',
      approvedAt: new Date().toISOString()
    })
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 Doc AI - Document Processing</h1>
        <p>Upload, classify, and review your documents with AI-powered extraction</p>
      </header>

      <Navigation
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        pendingCounts={{
          invoice: pendingDocuments.invoice.filter(d => d.status === 'pending').length,
          receipt: pendingDocuments.receipt.filter(d => d.status === 'pending').length,
          other: pendingDocuments.other.filter(d => d.status === 'pending').length
        }}
      />

      <main className="app-main">
        {activeSection === 'invoice' && (
          <InvoiceSection
            documents={pendingDocuments.invoice}
            onAddDocument={(doc) => addPendingDocument('invoice', doc)}
            onUpdateDocument={(id, updates) => updateDocument('invoice', id, updates)}
            onRemoveDocument={(id) => removeDocument('invoice', id)}
            onApproveDocument={(id) => approveDocument('invoice', id)}
          />
        )}

        {activeSection === 'receipt' && (
          <ReceiptSection
            documents={pendingDocuments.receipt}
            onAddDocument={(doc) => addPendingDocument('receipt', doc)}
            onUpdateDocument={(id, updates) => updateDocument('receipt', id, updates)}
            onRemoveDocument={(id) => removeDocument('receipt', id)}
            onApproveDocument={(id) => approveDocument('receipt', id)}
          />
        )}

        {activeSection === 'other' && (
          <OtherSection
            documents={pendingDocuments.other}
            onAddDocument={(doc) => addPendingDocument('other', doc)}
            onUpdateDocument={(id, updates) => updateDocument('other', id, updates)}
            onRemoveDocument={(id) => removeDocument('other', id)}
            onApproveDocument={(id) => approveDocument('other', id)}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>
          Powered by UDP - Parser Framework |
          <a href="https://github.com/yourusername/udp-parser" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}

export default App
