import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import DocumentUpload from './pages/DocumentUpload';
import DocumentDetail from './pages/DocumentDetail';
import Rag from './pages/Rag';
import Settings from './pages/Settings';
import DocTypes from './pages/DocTypes';
import Landing from './pages/Landing';

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

  const AppShell = () => {
    const location = useLocation();
    const hideNavbar = location.pathname === '/';
    return (
      <div className="min-h-screen bg-primary transition-colors">
        {!hideNavbar && (
          <Navbar darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
        )}
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/upload" element={<DocumentUpload />} />
            <Route path="/document/:id" element={<DocumentDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/doc-types" element={<DocTypes />} />
            <Route path="/rag" element={<Rag />} />
            {/* Back-compat for old links */}
            <Route path="/rag-upload" element={<Rag />} />
            <Route path="/rag-manager" element={<Rag />} />
          </Routes>
        </main>
      </div>
    );
  };

  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
