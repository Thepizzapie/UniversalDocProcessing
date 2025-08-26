import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Link as LinkIcon, Loader, Tag, Database } from 'lucide-react';
import { apiService } from '../services/api';

const DocumentUpload = () => {
  const navigate = useNavigate();
  const [uploadMethod, setUploadMethod] = useState('file'); // 'file' or 'url'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Document type selection
  const [documentType, setDocumentType] = useState('UNKNOWN');
  const [documentTypes, setDocumentTypes] = useState([]);
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  
  // URL upload state
  const [urlData, setUrlData] = useState({
    filename: '',
    mime_type: '',
    url: '',
    document_type: 'UNKNOWN'
  });

  useEffect(() => {
    loadDocumentTypes();
  }, []);

  const loadDocumentTypes = async () => {
    try {
      const response = await apiService.getDocumentTypeTemplates();
      setDocumentTypes(response.data);
    } catch (err) {
      console.error('Failed to load document types:', err);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiService.uploadDocument(selectedFile, selectedFile.type, documentType);
      console.log('Upload response:', response.data);
      
      // Navigate to document detail page
      navigate(`/document/${response.data.document_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUrlUpload = async () => {
    if (!urlData.filename || !urlData.mime_type || !urlData.url) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const requestData = {
        ...urlData,
        document_type: documentType
      };
      const response = await apiService.ingestDocument(requestData);
      console.log('Ingest response:', response.data);
      
      // Navigate to document detail page
      navigate(`/document/${response.data.document_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Ingest failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Process Documents</h1>
        <p className="mt-2 text-gray-600">
          Upload documents to extract data through the DER pipeline
        </p>
        
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Database className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Looking to add reference data?
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  Use the <strong>RAG Knowledge</strong> section to add reference documents that help improve reconciliation accuracy.
                  This section is for processing documents through the extraction pipeline.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Method Selection */}
      <div className="mb-8">
        <div className="flex space-x-4">
          <button
            onClick={() => setUploadMethod('file')}
            className={`px-4 py-2 rounded-lg font-medium ${
              uploadMethod === 'file' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Upload className="inline h-4 w-4 mr-2" />
            Upload File
          </button>
          <button
            onClick={() => setUploadMethod('url')}
            className={`px-4 py-2 rounded-lg font-medium ${
              uploadMethod === 'url' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <LinkIcon className="inline h-4 w-4 mr-2" />
            From URL
          </button>
        </div>
      </div>

      {/* Document Type Selection */}
      <div className="mb-8">
        <div className="card">
          <div className="flex items-center mb-4">
            <Tag className="h-5 w-5 text-blue-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Document Type</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Select the type of document to enable specialized processing and validation
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { value: 'INVOICE', label: 'Invoice', desc: 'Bills and invoices' },
              { value: 'RECEIPT', label: 'Receipt', desc: 'Purchase receipts' },
              { value: 'ENTRY_EXIT_LOG', label: 'Entry/Exit Log', desc: 'Access logs' },
              { value: 'UNKNOWN', label: 'Unknown', desc: 'Auto-detect type' }
            ].map((type) => (
              <button
                key={type.value}
                onClick={() => setDocumentType(type.value)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  documentType === type.value
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-sm">{type.label}</div>
                <div className="text-xs text-gray-500">{type.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {uploadMethod === 'file' ? (
        /* File Upload UI */
        <div className="card">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="space-y-4">
                <FileText className="mx-auto h-12 w-12 text-blue-500" />
                <div>
                  <p className="text-lg font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-600">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type || 'Unknown type'}
                  </p>
                </div>
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="btn btn-secondary"
                    disabled={loading}
                  >
                    Choose Different File
                  </button>
                  <button
                    onClick={handleFileUpload}
                    disabled={loading}
                    className="btn btn-primary"
                  >
                    {loading ? (
                      <>
                        <Loader className="animate-spin h-4 w-4 mr-2" />
                        Uploading...
                      </>
                    ) : (
                      'Upload & Process'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div>
                  <p className="text-lg font-medium text-gray-900">
                    Drop your document here, or click to browse
                  </p>
                  <p className="text-sm text-gray-600">
                    Supports PDF, Word documents, images, and more
                  </p>
                </div>
                <input
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                />
                <label
                  htmlFor="file-upload"
                  className="btn btn-primary cursor-pointer inline-block"
                >
                  Browse Files
                </label>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* URL Upload UI */
        <div className="card">
          <div className="space-y-6">
            <div>
              <label className="label">Document Filename</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., invoice-2024-001.pdf"
                value={urlData.filename}
                onChange={(e) => setUrlData({ ...urlData, filename: e.target.value })}
              />
            </div>
            
            <div>
              <label className="label">MIME Type</label>
              <select
                className="input"
                value={urlData.mime_type}
                onChange={(e) => setUrlData({ ...urlData, mime_type: e.target.value })}
              >
                <option value="">Select MIME type...</option>
                <option value="application/pdf">PDF (application/pdf)</option>
                <option value="application/msword">Word Document (.doc)</option>
                <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                  Word Document (.docx)
                </option>
                <option value="text/plain">Text File (text/plain)</option>
                <option value="image/jpeg">JPEG Image</option>
                <option value="image/png">PNG Image</option>
              </select>
            </div>
            
            <div>
              <label className="label">Document URL</label>
              <input
                type="url"
                className="input"
                placeholder="https://example.com/document.pdf"
                value={urlData.url}
                onChange={(e) => setUrlData({ ...urlData, url: e.target.value })}
              />
            </div>
            
            <button
              onClick={handleUrlUpload}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin h-4 w-4 mr-2" />
                  Processing...
                </>
              ) : (
                'Ingest Document'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
