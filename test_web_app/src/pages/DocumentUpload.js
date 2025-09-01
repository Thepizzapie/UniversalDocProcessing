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
      const response = await apiService.getDocTypes();
      setDocumentTypes(response.data || []);
    } catch (err) {
      console.error('Failed to load document types:', err);
      // Fallback to empty array if API fails
      setDocumentTypes([]);
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
        <h1 className="text-3xl font-bold text-primary">Process Documents</h1>
        <p className="mt-2 text-secondary">
          Upload documents to extract data through the DER pipeline
        </p>
        
        <div className="mt-4 status-info rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Database className="h-5 w-5 text-accent-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-accent-800 dark:text-accent-200">
                Looking to add reference data?
              </h3>
              <div className="mt-2 text-sm text-accent-700 dark:text-accent-300">
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
                ? 'btn-accent' 
                : 'btn-secondary'
            }`}
          >
            <Upload className="inline h-4 w-4 mr-2" />
            Upload File
          </button>
          <button
            onClick={() => setUploadMethod('url')}
            className={`px-4 py-2 rounded-lg font-medium ${
              uploadMethod === 'url' 
                ? 'btn-accent' 
                : 'btn-secondary'
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
            <Tag className="h-5 w-5 text-accent-500 mr-2" />
            <h3 className="text-lg font-medium text-primary">Document Type</h3>
          </div>
          <p className="text-sm text-secondary mb-4">
            Select the type of document to enable specialized processing and validation
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Add Unknown option first */}
            <button
              onClick={() => setDocumentType('UNKNOWN')}
              className={`p-3 rounded-lg border text-left transition-colors ${
                documentType === 'UNKNOWN'
                  ? 'border-accent-500 bg-accent-50 dark:bg-accent-900 text-accent-900 dark:text-accent-100'
                  : 'border-primary-200 dark:border-primary-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-700'
              }`}
            >
              <div className="font-medium text-sm">Unknown</div>
              <div className="text-xs text-muted">Auto-detect type</div>
            </button>
            {/* Dynamic document types */}
            {documentTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setDocumentType(type.name)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  documentType === type.name
                    ? 'border-accent-500 bg-accent-50 dark:bg-accent-900 text-accent-900 dark:text-accent-100'
                    : 'border-primary-200 dark:border-primary-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-700'
                }`}
              >
                <div className="font-medium text-sm">{type.name}</div>
                <div className="text-xs text-muted">{type.description || 'Custom document type'}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 status-error rounded-lg">
          <p>{error}</p>
        </div>
      )}

      {uploadMethod === 'file' ? (
        /* File Upload UI */
        <div className="card">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-accent-400 bg-accent-50 dark:bg-accent-900' 
                : 'border-primary-300 dark:border-primary-600 hover:border-primary-400 dark:hover:border-primary-500'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="space-y-4">
                <FileText className="mx-auto h-12 w-12 text-accent-500" />
                <div>
                  <p className="text-lg font-medium text-primary">{selectedFile.name}</p>
                  <p className="text-sm text-secondary">
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
                <Upload className="mx-auto h-12 w-12 text-muted" />
                <div>
                  <p className="text-lg font-medium text-primary">
                    Drop your document here, or click to browse
                  </p>
                  <p className="text-sm text-secondary">
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
