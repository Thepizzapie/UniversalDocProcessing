import { useState } from 'react'
import './Navigation.css'

function Navigation({ activeSection, setActiveSection, pendingCounts }) {
  return (
    <nav className="main-navigation">
      <div className="nav-container">
        <button
          className={`nav-btn ${activeSection === 'invoice' ? 'active' : ''}`}
          onClick={() => setActiveSection('invoice')}
        >
          <span className="nav-icon">🧾</span>
          <span className="nav-label">Invoices</span>
          {pendingCounts.invoice > 0 && (
            <span className="nav-badge">{pendingCounts.invoice}</span>
          )}
        </button>

        <button
          className={`nav-btn ${activeSection === 'receipt' ? 'active' : ''}`}
          onClick={() => setActiveSection('receipt')}
        >
          <span className="nav-icon">🧾</span>
          <span className="nav-label">Receipts</span>
          {pendingCounts.receipt > 0 && (
            <span className="nav-badge">{pendingCounts.receipt}</span>
          )}
        </button>

        <button
          className={`nav-btn ${activeSection === 'other' ? 'active' : ''}`}
          onClick={() => setActiveSection('other')}
        >
          <span className="nav-icon">📄</span>
          <span className="nav-label">Other Documents</span>
          {pendingCounts.other > 0 && (
            <span className="nav-badge">{pendingCounts.other}</span>
          )}
        </button>
      </div>
    </nav>
  )
}

export default Navigation
