import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FileText,
  Upload,
  Activity,
  Home,
  Database,
  BookOpen,
  Settings
} from 'lucide-react';

const Navbar = () => {
  const location = useLocation();
  
  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Process Documents', href: '/upload', icon: Upload },
    { name: 'RAG Knowledge', href: '/rag-upload', icon: Database },
    { name: 'Browse References', href: '/rag-manager', icon: BookOpen },
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'System Health', href: '/health', icon: Activity },
  ];

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <FileText className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">
              DER Pipeline Test
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex space-x-8">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
