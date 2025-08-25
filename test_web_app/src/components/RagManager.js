import React, { useState, useEffect } from 'react';
import { Database, Search, Plus, Trash2, Tag, BookOpen } from 'lucide-react';
import { apiService } from '../services/api';

const RagManager = ({ documentType = 'INVOICE' }) => {
  const [ragDocuments, setRagDocuments] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState(documentType);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add form state
  const [newRagDoc, setNewRagDoc] = useState({
    document_type: documentType,
    reference_data: {},
    description: '',
    tags: []
  });

  useEffect(() => {
    loadRagDocuments();
  }, [selectedType]);

  const loadRagDocuments = async () => {
    try {
      const response = await apiService.getRagDocuments(selectedType);
      setRagDocuments(response.data);
    } catch (err) {
      console.error('Failed to load RAG documents:', err);
    }
  };

  const searchRagDocuments = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await apiService.searchRagDocuments({
        query: searchQuery,
        document_type: selectedType,
        limit: 10,
        similarity_threshold: 0.6
      });
      setSearchResults(response.data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const addRagDocument = async () => {
    try {
      await apiService.createRagDocument({
        ...newRagDoc,
        document_type: selectedType
      });
      
      // Reset form
      setNewRagDoc({
        document_type: selectedType,
        reference_data: {},
        description: '',
        tags: []
      });
      setShowAddForm(false);
      
      // Reload documents
      await loadRagDocuments();
    } catch (err) {
      console.error('Failed to add RAG document:', err);
    }
  };

  const deleteRagDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this reference document?')) {
      return;
    }

    try {
      await apiService.deleteRagDocument(docId);
      await loadRagDocuments();
    } catch (err) {
      console.error('Failed to delete RAG document:', err);
    }
  };

  const seedSampleData = async () => {
    try {
      await apiService.seedRagSampleData();
      await loadRagDocuments();
    } catch (err) {
      console.error('Failed to seed sample data:', err);
    }
  };

  const addTag = (tag) => {
    if (tag && !newRagDoc.tags.includes(tag)) {
      setNewRagDoc({
        ...newRagDoc,
        tags: [...newRagDoc.tags, tag]
      });
    }
  };

  const removeTag = (tagToRemove) => {
    setNewRagDoc({
      ...newRagDoc,
      tags: newRagDoc.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const updateReferenceData = (key, value) => {
    setNewRagDoc({
      ...newRagDoc,
      reference_data: {
        ...newRagDoc.reference_data,
        [key]: value
      }
    });
  };

  const documentTypeOptions = [
    { value: 'INVOICE', label: 'Invoice' },
    { value: 'RECEIPT', label: 'Receipt' },
    { value: 'ENTRY_EXIT_LOG', label: 'Entry/Exit Log' }
  ];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Database className="h-5 w-5 text-blue-500 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">RAG Knowledge Base</h3>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={seedSampleData}
            className="btn btn-secondary text-sm"
          >
            Seed Sample Data
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-primary text-sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Reference
          </button>
        </div>
      </div>

      {/* Document Type Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Document Type
        </label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="input max-w-xs"
        >
          {documentTypeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="flex space-x-2">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search reference documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
              onKeyPress={(e) => e.key === 'Enter' && searchRagDocuments()}
            />
          </div>
          <button
            onClick={searchRagDocuments}
            disabled={loading}
            className="btn btn-primary"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-4">Add Reference Document</h4>
          
          <div className="space-y-4">
            <div>
              <label className="label">Description</label>
              <input
                type="text"
                placeholder="Brief description of this reference"
                value={newRagDoc.description}
                onChange={(e) => setNewRagDoc({ ...newRagDoc, description: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="label">Reference Data (JSON)</label>
              <textarea
                placeholder='{"vendor_name": "ACME Corp", "typical_amount": 1000}'
                value={JSON.stringify(newRagDoc.reference_data, null, 2)}
                onChange={(e) => {
                  try {
                    const data = JSON.parse(e.target.value);
                    setNewRagDoc({ ...newRagDoc, reference_data: data });
                  } catch (err) {
                    // Invalid JSON, keep typing
                  }
                }}
                className="input h-32 font-mono text-sm"
              />
            </div>

            <div>
              <label className="label">Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {newRagDoc.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full flex items-center"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-blue-500 hover:text-blue-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                placeholder="Add tag and press Enter"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addTag(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="input"
              />
            </div>

            <div className="flex space-x-2">
              <button
                onClick={addRagDocument}
                className="btn btn-primary"
              >
                Add Reference
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Search Results</h4>
          <div className="space-y-3">
            {searchResults.map((result, index) => (
              <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-yellow-800">
                    Similarity: {(result.similarity_score * 100).toFixed(1)}%
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {result.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-yellow-200 text-yellow-700 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                {result.description && (
                  <p className="text-sm text-gray-700 mb-2">{result.description}</p>
                )}
                <pre className="text-xs text-gray-600 bg-white p-2 rounded border overflow-x-auto">
                  {JSON.stringify(result.reference_data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reference Documents List */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">
          Reference Documents ({ragDocuments.length})
        </h4>
        
        {ragDocuments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <BookOpen className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>No reference documents found for {selectedType}</p>
            <p className="text-sm">Add some reference data to improve reconciliation accuracy</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ragDocuments.map((doc) => (
              <div key={doc.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <BookOpen className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="font-medium text-gray-900">
                      {doc.description || `Reference #${doc.id}`}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteRagDocument(doc.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                
                {doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {doc.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        <Tag className="h-3 w-3 inline mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                
                <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded border overflow-x-auto">
                  {JSON.stringify(doc.reference_data, null, 2)}
                </pre>
                
                <div className="mt-2 text-xs text-gray-500">
                  Created: {new Date(doc.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RagManager;
