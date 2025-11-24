import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Upload from './pages/Upload';
import Dashboard from './pages/Dashboard';
import Review from './pages/Review';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <Routes>
          <Route path="/" element={<Upload />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/review/:id" element={<Review />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
