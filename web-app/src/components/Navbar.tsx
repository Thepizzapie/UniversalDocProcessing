import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="text-xl font-bold">
              UDP System
            </Link>
            <div className="flex space-x-4">
              <Link
                to="/"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/')
                    ? 'bg-blue-700'
                    : 'hover:bg-blue-500'
                }`}
              >
                Upload
              </Link>
              <Link
                to="/dashboard"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/dashboard')
                    ? 'bg-blue-700'
                    : 'hover:bg-blue-500'
                }`}
              >
                Dashboard
              </Link>
            </div>
          </div>
          <div className="text-sm">
            <span className="opacity-75">Universal Document Processing</span>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
