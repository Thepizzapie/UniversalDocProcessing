import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to ${config.url}`);
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// API service methods
export const apiService = {
  // Health checks
  healthCheck: () => api.get('/health'),
  aiHealthCheck: () => api.get('/ai-health'),
  testAiExtraction: (testText) => api.post('/ai-health/test', { test_text: testText }),
  
  // Step 1: Ingest
  ingestDocument: (data) => api.post('/ingest', data),
  uploadDocument: (file, mimeType) => {
    const formData = new FormData();
    formData.append('file', file);
    if (mimeType) formData.append('mime_type', mimeType);
    
    return api.post('/ingest/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  // Step 2: HIL (Human in the Loop)
  getHilData: (documentId) => api.get(`/hil/${documentId}`),
  updateHilCorrections: (documentId, data) => api.post(`/hil/${documentId}`, data),
  
  // Step 3: Fetch
  fetchComparatorData: (documentId, data) => api.post(`/fetch/${documentId}`, data),
  getFetchStatus: (documentId) => api.get(`/fetch/${documentId}/status`),
  
  // Step 4: Reconcile
  reconcileDocument: (documentId, data) => api.post(`/reconcile/${documentId}`, data),
  
  // Step 5: Finalize
  finalizeDocument: (documentId, data) => api.post(`/finalize/${documentId}`, data),
  
  // Reports
  getDocumentReport: (documentId) => api.get(`/reports/${documentId}`),
  getAllDocuments: () => api.get('/reports/documents'),
  
  // Document Types
  getDocumentTypeTemplates: () => api.get('/document-types/templates'),
  getDocumentTypeTemplate: (documentType) => api.get(`/document-types/${documentType}/template`),
  getDocumentsByType: (documentType) => api.get(`/document-types/${documentType}/documents`),
  updateDocumentType: (documentId, newType) => api.put(`/document-types/${documentId}/type`, newType),
  getDocumentTypeStats: () => api.get('/document-types/stats'),
  
  // RAG System
  createRagDocument: (data) => api.post('/rag/documents', data),
  getRagDocuments: (documentType) => api.get(`/rag/documents/${documentType}`),
  searchRagDocuments: (data) => api.post('/rag/search', data),
  deleteRagDocument: (docId) => api.delete(`/rag/documents/${docId}`),
  seedRagSampleData: () => api.post('/rag/seed-sample-data'),
  
  // Debugging
  debugExtraction: (documentId, data) => api.post(`/debug/extraction/${documentId}`, data),
  debugReconciliation: (documentId, data) => api.post(`/debug/reconciliation/${documentId}`, data),
  debugHilFeedback: (documentId, data) => api.post(`/debug/hil/${documentId}`, data),
  debugPipelinePerformance: (documentId, data) => api.post(`/debug/performance/${documentId}`, data),
  getDebugHistory: (documentId) => api.get(`/debug/history/${documentId}`),
};

export default api;
