// DEPRECATED: merged into Rag.js page.
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Upload, FileText, Plus, Save, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';

const RagUpload = () => {
  const navigate = useNavigate();
  const [documentType, setDocumentType] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [referenceData, setReferenceData] = useState('{}');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [documentTypes, setDocumentTypes] = useState([]);

  // Template data for different document types
  const getTemplate = (typeName) => {
    // Find the document type definition
    const docType = documentTypes.find(dt => dt.name === typeName);
    if (docType && docType.output_schema) {
      // Create a sample template based on the schema
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
    
    // Fallback for legacy types or when no schema is available
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
          line_item_categories: ['services', 'products', 'consulting']
        };
      case 'RECEIPT':
        return {
          merchant_name: 'Example Store',
          merchant_address: '456 Retail Ave, Shopping City, State 54321',
          typical_items: ['coffee', 'food', 'retail goods'],
          typical_amount_range: [5, 500],
          currency: 'USD',
          payment_methods: ['cash', 'credit', 'debit'],
          business_hours: '8:00 AM - 9:00 PM'
        };
      case 'ENTRY_EXIT_LOG':
        return {
          location: 'Building A - Main Entrance',
          authorized_personnel: ['John Doe', 'Jane Smith'],
          access_levels: ['standard', 'elevated', 'admin'],
          standard_hours: '8:00 AM - 6:00 PM',
          security_protocols: ['badge_required', 'escort_required'],
          badge_prefix: 'EMP'
        };
      default:
        return {
          example_field: 'Example value',
          description: 'Add relevant reference data for this document type'
        };
    }
  };

  useEffect(() => {
    loadDocumentTypes();
  }, []);

  useEffect(() => {
    // Auto-populate template when document type changes
    if (documentType) {
      const template = getTemplate(documentType);
      setReferenceData(JSON.stringify(template, null, 2));
    }
  }, [documentType]);

  const loadDocumentTypes = async () => {
    try {
      const response = await apiService.getDocTypes();
      const types = response.data || [];
      setDocumentTypes(types);
      // Set first type as default if available
      if (types.length > 0 && !documentType) {
        setDocumentType(types[0].name);
      }
    } catch (err) {
      console.error('Failed to load document types:', err);
    }
  };

  const addTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validate JSON
      const parsedData = JSON.parse(referenceData);
      
      // Check if this is a legacy document type that the RAG system supports
      const legacyTypes = ['INVOICE', 'RECEIPT', 'ENTRY_EXIT_LOG'];
      if (!legacyTypes.includes(documentType)) {
        setError(`RAG system does not yet support custom document type '${documentType}'. Only legacy types (INVOICE, RECEIPT, ENTRY_EXIT_LOG) are currently supported.`);
        return;
      }
      
      const response = await apiService.createRagDocument({
        document_type: documentType,
        reference_data: parsedData,
        description: description,
        tags: tags
      });

      setSuccess('Reference document added successfully!');
      
      // Reset form
      setDescription('');
      setTags([]);
      if (documentType) {
        const template = getTemplate(documentType);
        setReferenceData(JSON.stringify(template, null, 2));
      }
      
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      if (err.name === 'SyntaxError') {
        setError('Invalid JSON format in reference data');
      } else {
        setError(err.response?.data?.detail || 'Failed to add reference document');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = () => {
    if (documentType) {
      const template = getTemplate(documentType);
      setReferenceData(JSON.stringify(template, null, 2));
    }
  };

  const seedSampleData = async () => {
    setLoading(true);
    try {
      await apiService.seedRagSampleData();
      setSuccess('Sample data seeded successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to seed sample data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <Database className="h-8 w-8 text-accent-500 mr-3" />
          <div>
            <h1 className="text-3xl font-bold text-primary">RAG Knowledge Base</h1>
            <p className="mt-2 text-secondary">
              Add reference documents to improve reconciliation accuracy
            </p>
          </div>
        </div>
        
        <div className="status-info rounded-lg p-4">
          <div className="flex items-start">
            <Database className="h-5 w-5 text-accent-500 mr-2 mt-0.5" />
            <div>
              <h3 className="font-medium text-accent-800 dark:text-accent-200">About RAG Reference Data</h3>
              <p className="text-sm text-accent-700 dark:text-accent-300 mt-1">
                Reference documents help the AI system make better reconciliation decisions by providing 
                known good examples of vendor data, merchant information, and access patterns. The more 
                reference data you provide, the more accurate the reconciliation process becomes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
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

      {/* Quick Actions */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={seedSampleData}
            disabled={loading}
            className="btn btn-secondary"
          >
            <Database className="h-4 w-4 mr-2" />
            Seed Sample Data
          </button>
          
          <button
            onClick={() => navigate('/rag-manager')}
            className="btn btn-secondary"
          >
            <FileText className="h-4 w-4 mr-2" />
            Browse Existing References
          </button>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="text-lg font-medium text-primary mb-6">Add Reference Document</h2>
          
          {/* Document Type Selection */}
          <div className="mb-6">
            <label className="label">Document Type</label>
            {documentTypes.length === 0 ? (
              <div className="p-4 border border-primary-200 dark:border-primary-700 rounded-lg text-center">
                <p className="text-muted">No document types available.</p>
                <p className="text-sm text-muted mt-1">
                  Create document types in the <strong>Doc Types</strong> section first.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/doc-types')}
                  className="btn btn-primary mt-3"
                >
                  Go to Doc Types
                </button>
              </div>
            ) : (
              <>
                {/* Legacy document types warning */}
                <div className="mb-4 p-4 status-warning rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Note:</strong> The RAG system currently only supports legacy document types (INVOICE, RECEIPT, ENTRY_EXIT_LOG). 
                    Support for custom document types will be added in a future update.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {documentTypes.map((type) => {
                    const isLegacyType = ['INVOICE', 'RECEIPT', 'ENTRY_EXIT_LOG'].includes(type.name);
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setDocumentType(type.name)}
                        disabled={!isLegacyType}
                        className={`p-4 rounded-lg border text-left transition-colors ${
                          !isLegacyType
                            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500'
                            : documentType === type.name
                              ? 'border-accent-500 bg-accent-50 dark:bg-accent-900 text-accent-900 dark:text-accent-100'
                              : 'border-primary-200 dark:border-primary-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-700'
                        }`}
                      >
                        <div className="font-medium">{type.name}</div>
                        <div className="text-sm text-muted">
                          {isLegacyType ? (type.description || 'Legacy document type') : 'Not supported yet'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="label">Description</label>
            <input
              type="text"
              placeholder="Brief description of this reference (e.g., 'ACME Corp vendor master data')"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              required
            />
          </div>

          {/* Tags */}
          <div className="mb-6">
            <label className="label">Tags</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-primary-100 dark:bg-primary-700 text-primary text-sm rounded-full flex items-center"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-2 text-muted hover:text-primary"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Add tag (e.g., 'vendor', 'frequent', 'approved')"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="input flex-1"
              />
              <button
                type="button"
                onClick={addTag}
                className="btn btn-secondary"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Reference Data */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="label">Reference Data (JSON)</label>
              <button
                type="button"
                onClick={loadTemplate}
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
            <p className="text-xs text-muted mt-1">
              This data will be used by the AI system to make better reconciliation decisions.
              Include typical values, patterns, and known good examples.
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !documentType}
              className="btn btn-primary"
            >
              {loading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  Adding Reference...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Add Reference Document
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Documentation */}
      <div className="mt-8 card">
        <h3 className="text-lg font-medium text-primary mb-4">Reference Data Guidelines</h3>
        
        <div className="space-y-4 text-sm text-secondary">
          <div>
            <h4 className="font-medium text-primary">General Guidelines:</h4>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Include typical values and patterns for your document type</li>
              <li>Add known good examples that the AI can reference</li>
              <li>Specify ranges, formats, and validation rules where applicable</li>
              <li>Include contact information and identifiers when relevant</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-primary">For Financial Documents:</h4>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Include vendor/merchant information and tax IDs</li>
              <li>Add typical payment terms and amount ranges</li>
              <li>Specify currency and regional information</li>
              <li>Include common categories and item types</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-primary">For Access/Security Documents:</h4>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Include authorized personnel lists and access levels</li>
              <li>Add location and facility information</li>
              <li>Specify security protocols and requirements</li>
              <li>Include badge patterns and numbering schemes</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-primary">For Custom Document Types:</h4>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Base your reference data on the schema defined in Doc Types</li>
              <li>Include examples for each field in your document schema</li>
              <li>Add validation patterns and typical value ranges</li>
              <li>Consider edge cases and variations in your documents</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RagUpload;
