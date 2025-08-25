import React, { useState, useEffect } from 'react';
import { Database, Search, Edit, Trash2, Tag, BookOpen, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

const RagManager = () => {
  const navigate = useNavigate();
  const [ragDocuments, setRagDocuments] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState('INVOICE');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPerformed, setSearchPerformed] = useState(false);

  useEffect(() => {
    loadRagDocuments();
  }, [selectedType]);

  const loadRagDocuments = async () => {
    setLoading(true);
    try {
      const response = await apiService.getRagDocuments(selectedType);
      setRagDocuments(response.data);
    } catch (err) {
      console.error('Failed to load RAG documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchRagDocuments = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSearchPerformed(true);
    try {
      const response = await apiService.searchRagDocuments({
        query: searchQuery,
        document_type: selectedType,
        limit: 20,
        similarity_threshold: 0.3
      });
      setSearchResults(response.data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteRagDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this reference document?')) {
      return;
    }

    try {
      await apiService.deleteRagDocument(docId);
      await loadRagDocuments();
      // If the deleted document was in search results, refresh search
      if (searchPerformed) {
        await searchRagDocuments();
      }
    } catch (err) {
      console.error('Failed to delete RAG document:', err);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchPerformed(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'INVOICE':
        return 'bg-blue-100 text-blue-700';
      case 'RECEIPT':
        return 'bg-green-100 text-green-700';
      case 'ENTRY_EXIT_LOG':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const documentTypeOptions = [
    { value: 'INVOICE', label: 'Invoice' },
    { value: 'RECEIPT', label: 'Receipt' },
    { value: 'ENTRY_EXIT_LOG', label: 'Entry/Exit Log' }
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="mr-4 p-2 text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Database className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">RAG Knowledge Base Manager</h1>
              <p className="mt-2 text-gray-600">
                Manage reference documents for improved reconciliation accuracy
              </p>
            </div>
          </div>
          
          <button
            onClick={() => navigate('/rag-upload')}
            className="btn btn-primary"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Add Reference
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="mb-8 card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Document Type Filter */}
          <div>
            <label className="label">Document Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="input"
            >
              {documentTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="label">Semantic Search</label>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Search reference documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input flex-1"
                onKeyPress={(e) => e.key === 'Enter' && searchRagDocuments()}
              />
              <button
                onClick={searchRagDocuments}
                disabled={loading || !searchQuery.trim()}
                className="btn btn-primary"
              >
                <Search className="h-4 w-4" />
              </button>
              {searchPerformed && (
                <button
                  onClick={clearSearch}
                  className="btn btn-secondary"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <Database className="h-6 w-6 text-blue-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-blue-900">{ragDocuments.length}</div>
              <div className="text-sm text-blue-600">Reference Documents</div>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <Search className="h-6 w-6 text-green-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-green-900">{searchResults.length}</div>
              <div className="text-sm text-green-600">Search Results</div>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center">
            <Tag className="h-6 w-6 text-purple-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-purple-900">
                {ragDocuments.reduce((total, doc) => total + doc.tags.length, 0)}
              </div>
              <div className="text-sm text-purple-600">Total Tags</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Results */}
      {searchPerformed && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Search Results ({searchResults.length})
          </h2>
          
          {searchResults.length === 0 ? (
            <div className="card text-center py-8">
              <Search className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-gray-500">No matching reference documents found</p>
              <p className="text-sm text-gray-400">Try adjusting your search terms or similarity threshold</p>
            </div>
          ) : (
            <div className="space-y-4">
              {searchResults.map((result, index) => (
                <div key={index} className="card border-l-4 border-yellow-400">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg font-medium text-yellow-600">
                        {(result.similarity_score * 100).toFixed(1)}% match
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {result.tags.map(tag => (
                          <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {result.description && (
                    <p className="text-gray-700 mb-3">{result.description}</p>
                  )}
                  
                  <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded border overflow-x-auto">
                    {JSON.stringify(result.reference_data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Reference Documents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">
            All {selectedType.replace(/_/g, ' ')} References ({ragDocuments.length})
          </h2>
        </div>
        
        {loading ? (
          <div className="card text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading reference documents...</p>
          </div>
        ) : ragDocuments.length === 0 ? (
          <div className="card text-center py-8">
            <BookOpen className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500">No reference documents found for {selectedType.replace(/_/g, ' ')}</p>
            <p className="text-sm text-gray-400">Add some reference data to improve reconciliation accuracy</p>
            <button
              onClick={() => navigate('/rag-upload')}
              className="btn btn-primary mt-4"
            >
              Add First Reference
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {ragDocuments.map((doc) => (
              <div key={doc.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <BookOpen className="h-5 w-5 text-gray-400" />
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {doc.description || `Reference #${doc.id}`}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(selectedType)}`}>
                          {selectedType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-gray-500">
                          Created: {formatDate(doc.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => deleteRagDocument(doc.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Delete reference"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {doc.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                
                <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded border overflow-x-auto">
                  {JSON.stringify(doc.reference_data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RagManager;
