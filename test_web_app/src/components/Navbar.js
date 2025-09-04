import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FileText,
  Upload,
  Home,
  Database,
  Settings,
  Moon,
  Sun
} from 'lucide-react';

const Navbar = ({ darkMode, toggleDarkMode }) => {
  const location = useLocation();
  
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Process Documents', href: '/upload', icon: Upload },
  { name: 'Recon RAG Knowledgebase', href: '/rag', icon: Database },
    { name: 'Doc Types', href: '/doc-types', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <nav className="bg-white dark:bg-primary-800 shadow-lg border-b border-primary-200 dark:border-primary-700 transition-colors">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <FileText className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-primary">Parser</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            <div className="flex space-x-6">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-100 dark:bg-primary-700 text-primary'
                        : 'text-secondary hover:text-primary hover:bg-primary-50 dark:hover:bg-primary-700'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
            
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-secondary hover:bg-primary-100 dark:hover:bg-primary-700 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
