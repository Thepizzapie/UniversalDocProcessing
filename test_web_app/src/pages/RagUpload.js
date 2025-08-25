import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Upload, FileText, Plus, Save, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';

const RagUpload = () => {
  const navigate = useNavigate();
  const [documentType, setDocumentType] = useState('INVOICE');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [referenceData, setReferenceData] = useState('{}');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Template data for different document types
  const getTemplate = (type) => {
    switch (type) {
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
        return {};
    }
  };

  useEffect(() => {
    // Auto-populate template when document type changes
    const template = getTemplate(documentType);
    setReferenceData(JSON.stringify(template, null, 2));
  }, [documentType]);

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
      const template = getTemplate(documentType);
      setReferenceData(JSON.stringify(template, null, 2));
      
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
    const template = getTemplate(documentType);
    setReferenceData(JSON.stringify(template, null, 2));
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
          <Database className="h-8 w-8 text-blue-500 mr-3" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">RAG Knowledge Base</h1>
            <p className="mt-2 text-gray-600">
              Add reference documents to improve reconciliation accuracy
            </p>
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Database className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900">About RAG Reference Data</h3>
              <p className="text-sm text-blue-700 mt-1">
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
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
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
          <h2 className="text-lg font-medium text-gray-900 mb-6">Add Reference Document</h2>
          
          {/* Document Type Selection */}
          <div className="mb-6">
            <label className="label">Document Type</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'INVOICE', label: 'Invoice', desc: 'Vendor and billing data' },
                { value: 'RECEIPT', label: 'Receipt', desc: 'Merchant and transaction data' },
                { value: 'ENTRY_EXIT_LOG', label: 'Entry/Exit Log', desc: 'Access control data' }
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setDocumentType(type.value)}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    documentType === type.value
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{type.label}</div>
                  <div className="text-sm text-gray-500">{type.desc}</div>
                </button>
              ))}
            </div>
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
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full flex items-center"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-2 text-gray-500 hover:text-gray-700"
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
                className="text-sm text-blue-600 hover:text-blue-700"
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
            <p className="text-xs text-gray-500 mt-1">
              This data will be used by the AI system to make better reconciliation decisions.
              Include typical values, patterns, and known good examples.
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
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
        <h3 className="text-lg font-medium text-gray-900 mb-4">Reference Data Guidelines</h3>
        
        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <h4 className="font-medium text-gray-900">For Invoices:</h4>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Include vendor contact information and tax IDs</li>
              <li>Add typical payment terms and amount ranges</li>
              <li>Specify common line item categories</li>
              <li>Include currency and regional information</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900">For Receipts:</h4>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Include merchant names and locations</li>
              <li>Add typical product categories and price ranges</li>
              <li>Specify accepted payment methods</li>
              <li>Include business hours and contact information</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900">For Entry/Exit Logs:</h4>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Include authorized personnel lists</li>
              <li>Add location and access level information</li>
              <li>Specify security protocols and requirements</li>
              <li>Include badge patterns and numbering schemes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RagUpload;
