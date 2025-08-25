import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import DocumentUpload from './pages/DocumentUpload';
import DocumentDetail from './pages/DocumentDetail';
import SystemHealth from './pages/SystemHealth';
import RagUpload from './pages/RagUpload';
import RagManager from './pages/RagManager';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<DocumentUpload />} />
            <Route path="/document/:id" element={<DocumentDetail />} />
            <Route path="/health" element={<SystemHealth />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/rag-upload" element={<RagUpload />} />
            <Route path="/rag-manager" element={<RagManager />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
