import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Simple JWT helpers ---
const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

const isTokenValid = (token) => {
  if (!token) return false;
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp - 10 > now; // 10s clock skew
};

const AUTH_KEYS = {
  token: 'auth_token',
  email: 'auth_email',
  password: 'auth_password',
};

async function login(email, password) {
  const res = await api.post('/auth/login', { email, password });
  return res.data;
}

async function register(email, password, role = 'reviewer') {
  const res = await api.post('/auth/register', { email, password, role });
  return res.data;
}

async function ensureReviewerAuth() {
  let token = localStorage.getItem(AUTH_KEYS.token);
  if (isTokenValid(token)) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return token;
  }

  // Use a deterministic local demo account
  let email = localStorage.getItem(AUTH_KEYS.email) || 'reviewer@example.com';
  let password = localStorage.getItem(AUTH_KEYS.password) || 'test1234!';

  try {
    const data = await login(email, password);
    token = data.access_token;
  } catch (e) {
    // If login fails, try register then login
    await register(email, password, 'reviewer');
    const data = await login(email, password);
    token = data.access_token;
  }

  localStorage.setItem(AUTH_KEYS.email, email);
  localStorage.setItem(AUTH_KEYS.password, password);
  localStorage.setItem(AUTH_KEYS.token, token);
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  return token;
}

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to ${config.url}`);
    const tenantId = localStorage.getItem('tenantId') || '1'; // Default to tenant ID 1
    config.headers['X-Tenant-ID'] = tenantId;
    // Attach Authorization token if available
    const token = localStorage.getItem(AUTH_KEYS.token);
    if (token && isTokenValid(token)) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and auto-auth retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config;
    if (status === 401 && original && !original.__retry) {
      try {
        await ensureReviewerAuth();
        original.__retry = true;
        return api(original);
      } catch (e) {
        // Fall through to caller with original error
      }
    }
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// API service methods
export const apiService = {
  ensureReviewerAuth,
  login: (email, password) => login(email, password),
  register: (email, password, role) => register(email, password, role),
  setTenantId: (tenantId) => localStorage.setItem('tenantId', tenantId),
  // Health checks
  healthCheck: () => api.get('/health'),
  aiHealthCheck: () => api.get('/ai-health'),
  testAiExtraction: (testText) => api.post('/ai-health/test', { test_text: testText }),
  generateAiSchema: (documentDescription, documentType) => api.post('/ai-health/generate-schema', {
    document_description: documentDescription,
    document_type: documentType || 'custom'
  }),
  
  // Step 1: Ingest
  ingestDocument: (data) => api.post('/ingest', data),
  reExtractDocument: (documentId, customDocTypeName) => {
    const formData = new FormData();
    if (customDocTypeName) formData.append('custom_doc_type_name', customDocTypeName);
    return api.post(`/ingest/re-extract/${documentId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  uploadDocument: (file, mimeType, documentType, customDocTypeName) => {
    const formData = new FormData();
    formData.append('file', file);
    if (mimeType) formData.append('mime_type', mimeType);
    if (documentType) formData.append('document_type', documentType);
    if (customDocTypeName) formData.append('custom_doc_type_name', customDocTypeName);
    
    return api.post('/ingest/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  // Step 2: HIL (Human in the Loop)
  getHilData: (documentId) => api.get(`/hil/${documentId}`),
  updateHilCorrections: (documentId, data) => api.post(`/hil/${documentId}`, data),
  submitHilReview: (documentId, reviewData) => api.post(`/hil/${documentId}/review`, reviewData),
  
  // Step 3: Fetch
  fetchComparatorData: (documentId, data) => api.post(`/fetch/${documentId}`, data),
  getFetchStatus: (documentId) => api.get(`/fetch/${documentId}/status`),
  
  // Step 4: Reconcile
  reconcileDocument: (documentId, data) => api.post(`/reconcile/${documentId}`, data),
  
  // Step 5: Finalize
  finalizeDocument: async (documentId, data) => {
    await ensureReviewerAuth();
    return api.post(`/finalize/${documentId}`, data);
  },
  
  // Reports
  getDocumentReport: (documentId) => api.get(`/reports/${documentId}`),
  getAllDocuments: () => api.get('/reports/documents'),
  deleteDocument: (documentId) => api.delete(`/reports/documents/${documentId}`),
  
  // Document Types
  getDocumentTypeTemplates: () => api.get('/document-types/templates'),
  getDocumentTypeTemplate: (documentType) => api.get(`/document-types/${documentType}/template`),
  getDocumentsByType: (documentType) => api.get(`/document-types/${documentType}/documents`),
  updateDocumentType: (documentId, newType) => api.put(`/document-types/${documentId}/type?new_type=${newType}`),
  getDocumentTypeStats: () => api.get('/document-types/stats'),
  
  // RAG System
  createRagDocument: (data) => api.post('/rag/documents', data),
  getRagDocuments: (documentType) => api.get(`/rag/documents/${documentType}`),
  searchRagDocuments: (data) => api.post('/rag/search', data),
  deleteRagDocument: (docId) => api.delete(`/rag/documents/${docId}`),
  seedRagSampleData: () => api.post('/rag/seed-sample-data'),
  
  // Debugging
  dryRunExtraction: (documentId, data) => api.post(`/debug/dry-run/${documentId}`, data),
  debugExtraction: (documentId, data) => api.post(`/debug/extraction/${documentId}`, data),
  debugReconciliation: (documentId, data) => api.post(`/debug/reconciliation/${documentId}`, data),
  debugHilFeedback: (documentId, data) => api.post(`/debug/hil/${documentId}`, data),
  debugPipelinePerformance: (documentId, data) => api.post(`/debug/performance/${documentId}`, data),
  getDebugHistory: (documentId) => api.get(`/debug/history/${documentId}`),

    // Custom Pipeline API
  getPipelineTemplates: () => api.get('/custom-pipelines/templates'),
  getCustomDocTypes: () => api.get('/custom-pipelines/doc-types'),
  createCustomDocType: (data) => api.post('/custom-pipelines/doc-types', data),
  updateCustomDocType: (id, data) => api.put(`/custom-pipelines/doc-types/${id}`, data),
  deleteCustomDocType: (id) => api.delete(`/custom-pipelines/doc-types/${id}`),
  getCustomDocType: (id) => api.get(`/custom-pipelines/doc-types/${id}`),
  getPipelineConfig: (id) => api.get(`/custom-pipelines/doc-types/${id}/pipeline`),
};

export default api;
