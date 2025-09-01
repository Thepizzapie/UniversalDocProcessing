import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import DocumentUpload from './pages/DocumentUpload';
import DocumentDetail from './pages/DocumentDetail';
import SystemHealth from './pages/SystemHealth';
import RagUpload from './pages/RagUpload';
import RagManager from './pages/RagManager';
import Settings from './pages/Settings';
import DocTypes from './pages/DocTypes';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage for saved theme preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    // Default to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Apply dark mode class to document
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Save preference to localStorage
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <Router>
      <div className="min-h-screen bg-primary transition-colors">
        <Navbar darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<DocumentUpload />} />
            <Route path="/document/:id" element={<DocumentDetail />} />
            <Route path="/health" element={<SystemHealth />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/doc-types" element={<DocTypes />} />
            <Route path="/rag-upload" element={<RagUpload />} />
            <Route path="/rag-manager" element={<RagManager />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
