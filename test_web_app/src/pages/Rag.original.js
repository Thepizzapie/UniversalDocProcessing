import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Database, Upload, Save, Trash2, Search, BookOpen, Plus, ArrowLeft } from 'lucide-react';
import { apiService } from '../services/api';

// Combined RAG page: upload/add reference + browse/search manager
const Rag = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Shared state
  const [documentTypes, setDocumentTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Browse/Search state
  const [ragDocuments, setRagDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Add form state
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [referenceData, setReferenceData] = useState('{}');

  const legacyTypes = useMemo(() => ['INVOICE', 'RECEIPT', 'ENTRY_EXIT_LOG'], []);

  // Template generator borrowed from previous RagUpload
  const getTemplate = useCallback((typeName) => {
    const docType = documentTypes.find((dt) => dt.name === typeName);
    if (docType && docType.output_schema) {
      const template = {};
      Object.entries(docType.output_schema).forEach(([fieldName, fieldDef]) => {
        switch (fieldDef.type) {
          case 'string':
            template[fieldName] = fieldDef.default || `Example ${fieldName}`;
            break;
          case 'number':
            template[fieldName] = fieldDef.default || 100;
            break;
          case 'boolean':
            template[fieldName] = fieldDef.default || false;
            break;
          case 'array':
            template[fieldName] = fieldDef.default || [`Example ${fieldName} item`];
            break;
          case 'object':
            template[fieldName] = fieldDef.default || {};
            break;
          default:
            template[fieldName] = fieldDef.default || `Example ${fieldName}`;
        }
      });
      return template;
    }

    switch (typeName) {
      case 'INVOICE':
        return {
          vendor_name: 'Example Vendor Corp',
          vendor_address: '123 Business St, City, State 12345',
          vendor_tax_id: '12-3456789',
          typical_payment_terms: 'Net 30',
          currency: 'USD',
          contact_email: 'billing@example.com',
          typical_amount_range: [100, 50000],
          line_item_categories: ['services', 'products', 'consulting'],
        };
      case 'RECEIPT':
        return {
          merchant_name: 'Example Store',
          merchant_address: '456 Retail Ave, Shopping City, State 54321',
          typical_items: ['coffee', 'food', 'retail goods'],
          typical_amount_range: [5, 500],
          currency: 'USD',
          payment_methods: ['cash', 'credit', 'debit'],
          business_hours: '8:00 AM - 9:00 PM',
        };
      case 'ENTRY_EXIT_LOG':
        return {
          location: 'Building A - Main Entrance',
          authorized_personnel: ['John Doe', 'Jane Smith'],
          access_levels: ['standard', 'elevated', 'admin'],
          standard_hours: '8:00 AM - 6:00 PM',
          security_protocols: ['badge_required', 'escort_required'],
          badge_prefix: 'EMP',
        };
      default:
        return {
          example_field: 'Example value',
          description: 'Add relevant reference data for this document type',
        };
    }
  }, [documentTypes]);

  // Loaders (defined before effects to satisfy linter)
  const loadDocumentTypes = useCallback(async () => {
    try {
      const response = await apiService.getDocTypes();
      const types = response.data || [];
      setDocumentTypes(types);
      if (types.length > 0 && !selectedType) {
        setSelectedType(types[0].name);
      }
    } catch (err) {
      console.error('Failed to load document types:', err);
    }
  }, [selectedType]);

  const loadRagDocuments = useCallback(async () => {
    if (!selectedType) return;
    setLoading(true);
    try {
      if (legacyTypes.includes(selectedType)) {
        const response = await apiService.getRagDocuments(selectedType);
        setRagDocuments(response.data);
      } else {
        setRagDocuments([]);
      }
    } catch (err) {
      console.error('Failed to load RAG documents:', err);
      setRagDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [legacyTypes, selectedType]);

  // Effects
  useEffect(() => {
    loadDocumentTypes();
    // If user came from legacy routes, optionally focus a section via hash
    if (location.pathname.includes('rag-upload')) {
      // default focus is Add form; no special handling needed
    }
  }, [location.pathname, loadDocumentTypes]);

  useEffect(() => {
    if (selectedType) {
      const template = getTemplate(selectedType);
      setReferenceData(JSON.stringify(template, null, 2));
      loadRagDocuments();
    }
  }, [selectedType, getTemplate, loadRagDocuments]);

  // Loaders moved above

  // Actions
  const seedSampleData = async () => {
    setLoading(true);
    try {
      await apiService.seedRagSampleData();
      setSuccess('Sample data seeded successfully!');
      await loadRagDocuments();
      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      setError('Failed to seed sample data');
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
        similarity_threshold: 0.3,
      });
      setSearchResults(response.data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteRagDocument = async (docId) => {
    if (!window.confirm('Delete this reference document?')) return;
    try {
      await apiService.deleteRagDocument(docId);
      await loadRagDocuments();
      if (searchPerformed) await searchRagDocuments();
    } catch (err) {
      console.error('Failed to delete RAG document:', err);
    }
  };

  const addTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleAddReference = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const parsed = JSON.parse(referenceData);
      if (!legacyTypes.includes(selectedType)) {
        setError(
          `RAG system does not yet support custom document type '${selectedType}'. Only legacy types (${legacyTypes.join(
            ', '
          )}) are currently supported.`
        );
        return;
      }
      await apiService.createRagDocument({
        document_type: selectedType,
        reference_data: parsed,
        description,
        tags,
      });
      setSuccess('Reference document added successfully!');
      setDescription('');
      setTags([]);
      setReferenceData(JSON.stringify(getTemplate(selectedType), null, 2));
      await loadRagDocuments();
      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      if (err.name === 'SyntaxError') setError('Invalid JSON format in reference data');
      else setError(err.response?.data?.detail || 'Failed to add reference document');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="mr-4 p-2 text-muted hover:text-primary">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Database className="h-8 w-8 text-accent-500 mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-primary">RAG Knowledge Base</h1>
              <p className="mt-2 text-secondary">Add, search, and manage reference documents</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="mb-6 p-4 status-success rounded-lg">
          <p>{success}</p>
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 status-error rounded-lg">
          <p>{error}</p>
        </div>
      )}

      {/* Controls */}
      <div className="mb-8 card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Document Type */}
          <div>
            <label className="label">Document Type</label>
            {documentTypes.length === 0 ? (
              <div className="p-4 border border-primary-200 dark:border-primary-700 rounded-lg text-center">
                <p className="text-muted">No document types available.</p>
                <p className="text-sm text-muted mt-1">
                  Create document types in the <strong>Doc Types</strong> section first.
                </p>
                <button type="button" onClick={() => navigate('/doc-types')} className="btn btn-primary mt-3">
                  Go to Doc Types
                </button>
              </div>
            ) : (
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="input">
                {documentTypes.map((type) => (
                  <option key={type.id} value={type.name}>
                    {type.name}
                  </option>
                ))}
              </select>
            )}
            {/* Legacy types note */}
            <div className="mt-3 p-3 status-warning rounded-lg">
              <p className="text-xs">
                Note: RAG currently supports legacy types ({legacyTypes.join(', ')}). Support for custom types will arrive in a future update.
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <div>
            <label className="label">Quick Actions</label>
            <div className="flex flex-wrap gap-3">
              <button onClick={seedSampleData} disabled={loading} className="btn btn-secondary">
                <Database className="h-4 w-4 mr-2" />
                Seed Sample Data
              </button>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="btn btn-secondary">
                <BookOpen className="h-4 w-4 mr-2" />
                Top
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Layout: Left add form, right browse/search */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Reference */}
        <form onSubmit={handleAddReference} className="card">
          <h2 className="text-lg font-medium text-primary mb-6">Add Reference Document</h2>

          <div className="mb-4">
            <label className="label">Description</label>
            <input
              type="text"
              placeholder="Brief description (e.g., 'ACME vendor master data')"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              required
            />
          </div>

          <div className="mb-4">
            <label className="label">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span key={tag} className="px-3 py-1 bg-primary-100 dark:bg-primary-700 text-primary text-sm rounded-full flex items-center">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="ml-2 text-muted hover:text-primary">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Add tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="input flex-1"
              />
              <button type="button" onClick={addTag} className="btn btn-secondary">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="label">Reference Data (JSON)</label>
              <button
                type="button"
                onClick={() => setReferenceData(JSON.stringify(getTemplate(selectedType), null, 2))}
                className="text-sm text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
              >
                Load Template
              </button>
            </div>
            <textarea
              value={referenceData}
              onChange={(e) => setReferenceData(e.target.value)}
              className="input h-64 font-mono text-sm"
              placeholder="Enter JSON data for this reference document..."
              required
            />
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={loading || !selectedType} className="btn btn-primary">
              {loading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" /> Adding...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" /> Add Reference
                </>
              )}
            </button>
          </div>
        </form>

        {/* Browse/Search */}
        <div>
          <div className="card mb-6">
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
              <button onClick={searchRagDocuments} disabled={loading || !searchQuery.trim()} className="btn btn-primary">
                <Search className="h-4 w-4" />
              </button>
              {searchPerformed && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchPerformed(false); }} className="btn btn-secondary">
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          {searchPerformed && (
            <div className="mb-8">
              <h2 className="text-lg font-medium text-primary mb-4">Search Results ({searchResults.length})</h2>
              {searchResults.length === 0 ? (
                <div className="card text-center py-8">
                  <Search className="h-8 w-8 mx-auto mb-2 text-muted" />
                  <p className="text-secondary">No matching reference documents found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {searchResults.map((result, idx) => (
                    <div key={idx} className="card border-l-4 border-yellow-400">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg font-medium text-yellow-600">{(result.similarity_score * 100).toFixed(1)}% match</span>
                          <div className="flex flex-wrap gap-1">
                            {result.tags.map((t) => (
                              <span key={t} className="px-2 py-1 bg-primary-100 dark:bg-primary-700 text-primary text-xs rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {result.description && <p className="text-primary mb-3">{result.description}</p>}
                      <pre className="text-xs text-secondary bg-primary-50 dark:bg-primary-700 p-3 rounded border border-primary-200 dark:border-primary-600 overflow-x-auto">
                        {JSON.stringify(result.reference_data, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* All docs */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-primary">All {selectedType} References ({ragDocuments.length})</h2>
            </div>
            {loading ? (
              <div className="card text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-secondary">Loading reference documents...</p>
              </div>
            ) : ragDocuments.length === 0 ? (
              <div className="card text-center py-8">
                <BookOpen className="h-8 w-8 mx-auto mb-2 text-muted" />
                {legacyTypes.includes(selectedType) ? (
                  <>
                    <p className="text-secondary">No reference documents found for {selectedType}</p>
                    <p className="text-sm text-muted">Add some reference data to improve reconciliation accuracy</p>
                  </>
                ) : (
                  <>
                    <p className="text-secondary">RAG not yet available for custom type: {selectedType}</p>
                    <p className="text-sm text-muted">Currently supported: {legacyTypes.join(', ')}</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {ragDocuments.map((doc) => (
                  <div key={doc.id} className="card">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <BookOpen className="h-5 w-5 text-muted" />
                        <div>
                          <h3 className="font-medium text-primary">{doc.description || `Reference #${doc.id}`}</h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100">{selectedType}</span>
                            <span className="text-xs text-muted">Created: {formatDate(doc.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button onClick={() => deleteRagDocument(doc.id)} className="text-red-500 hover:text-red-700 p-1" title="Delete reference">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {doc.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {doc.tags.map((t) => (
                          <span key={t} className="px-2 py-1 bg-accent-100 dark:bg-accent-900 text-accent-700 dark:text-accent-200 text-xs rounded-full">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <pre className="text-xs text-secondary bg-primary-50 dark:bg-primary-700 p-3 rounded border border-primary-200 dark:border-primary-600 overflow-x-auto">
                      {JSON.stringify(doc.reference_data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rag;
