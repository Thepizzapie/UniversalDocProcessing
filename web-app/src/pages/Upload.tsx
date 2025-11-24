import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { classifyExtract } from '../services/api';
import { saveDocument } from '../services/storage';
import { DOCUMENT_TYPES, ProcessedDocument } from '../types';

const Upload: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [docType, setDocType] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (files.length === 0) {
      setError('Please select at least one file to upload');
      return;
    }

    setLoading(true);
    setError('');

    // Create processing documents for all files
    const processingDocs = files.map(file => {
      const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return {
        id: docId,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        status: 'processing' as const,
        forcedType: docType || undefined,
      };
    });

    // Save all as processing
    processingDocs.forEach(doc => saveDocument(doc));

    // Navigate to dashboard immediately to show progress
    navigate('/dashboard');

    // Process all files asynchronously in the background with proper error handling
    const processFile = async (doc: ProcessedDocument, file: File) => {
      try {
        const result = await classifyExtract(file, docType || undefined, true);

        const processedDoc: ProcessedDocument = {
          ...doc,
          status: 'processed',
          result,
        };

        saveDocument(processedDoc);
      } catch (err: any) {
        console.error(`Failed to process document ${doc.fileName}:`, err);

        const errorDoc: ProcessedDocument = {
          ...doc,
          status: 'error',
          error: err.response?.data?.error || err.message || 'Failed to process document',
        };

        saveDocument(errorDoc);
      }
    };

    // Start all file processing tasks (no await - fire and forget)
    processingDocs.forEach((doc, index) => {
      processFile(doc, files[index]);
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Upload Document</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Document
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-blue-400 transition-colors">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                  >
                    <span>Upload a file</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      multiple
                      className="sr-only"
                      accept=".pdf,.png,.jpg,.jpeg,.tiff"
                      onChange={handleFileChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PDF, PNG, JPG, TIFF up to 10MB (multiple files supported)</p>
                {files.length > 0 && (
                  <div className="mt-2 text-sm text-green-600 font-medium">
                    <p>Selected {files.length} file{files.length !== 1 ? 's' : ''}:</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      {files.map((file, idx) => (
                        <li key={idx}>{file.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Document Type Selector */}
          <div>
            <label htmlFor="doc-type" className="block text-sm font-medium text-gray-700 mb-2">
              Document Type
            </label>
            <select
              id="doc-type"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-500">
              {docType
                ? 'Agent will extract fields specific to this document type'
                : 'Agent will automatically detect the document type'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={loading || files.length === 0}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                loading || files.length === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Starting Processing...
                </>
              ) : (
                `Process ${files.length} Document${files.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">How it works:</h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>OcrAgent extracts text using GPT-4 Vision</li>
            <li>ClassificationAgent determines document type</li>
            <li>ExtractionAgent extracts structured fields</li>
            <li>RefinementAgent validates and corrects data</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default Upload;
