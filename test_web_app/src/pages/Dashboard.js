import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { apiService } from '../services/api';

const Dashboard = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAllDocuments();
      setDocuments(response.data);
      setError('');
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const canDelete = (state) => !['APPROVED', 'REJECTED'].includes(state);

  const onDelete = async (docId) => {
    const ok = window.confirm('Delete this document? This cannot be undone.');
    if (!ok) return;
    try {
      await apiService.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.document_id !== docId));
    } catch (e) {
      alert(e?.response?.data?.detail || 'Failed to delete document');
    }
  };

  const getStateIcon = (state) => {
    switch (state) {
      case 'APPROVED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'REJECTED':
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'FINAL_REVIEW':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-primary-500" />;
    }
  };

  const getStateColor = (state) => {
    switch (state) {
      case 'APPROVED':
        return 'status-success';
      case 'REJECTED':
      case 'FAILED':
        return 'status-error';
      case 'FINAL_REVIEW':
        return 'status-warning';
      default:
        return 'bg-primary-100 dark:bg-primary-700 text-primary-800 dark:text-primary-200';
    }
  };

  const formatState = (state) => {
    return state.replace(/_/g, ' ').toLowerCase().replace(/\\b\\w/g, l => l.toUpperCase());
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

  const getDocumentTypeColor = (type) => {
    switch (type) {
      case 'INVOICE':
        return 'doc-type-invoice';
      case 'RECEIPT':
        return 'doc-type-receipt';
      case 'ENTRY_EXIT_LOG':
        return 'doc-type-log';
      default:
        return 'doc-type-default';
    }
  };

  const formatDocumentType = (type) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-500" />
        <span className="ml-2 text-secondary">Loading documents...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary">Dashboard</h1>
          <p className="mt-2 text-secondary">Monitor your document processing pipeline</p>
        </div>
        
        <div className="flex space-x-4">
          <button
            onClick={fetchDocuments}
            disabled={loading}
            className="btn btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <Link to="/upload" className="btn btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Upload Document
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 status-error rounded-lg">
          <p>{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-muted" />
            <div className="ml-4">
              <p className="text-sm font-medium text-secondary">Total Documents</p>
              <p className="text-2xl font-bold text-primary">{documents.length}</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-500 dark:text-yellow-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-secondary">In Progress</p>
              <p className="text-2xl font-bold text-primary">
                {documents.filter(doc => 
                  !['APPROVED', 'REJECTED', 'FAILED'].includes(doc.state)
                ).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500 dark:text-green-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-secondary">Approved</p>
              <p className="text-2xl font-bold text-primary">
                {documents.filter(doc => doc.state === 'APPROVED').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center">
            <XCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-secondary">Failed/Rejected</p>
              <p className="text-2xl font-bold text-primary">
                {documents.filter(doc => 
                  ['REJECTED', 'FAILED'].includes(doc.state)
                ).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="card">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-primary">Recent Documents</h2>
        </div>
        
        {documents.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted" />
            <h3 className="mt-4 text-lg font-medium text-primary">No documents yet</h3>
            <p className="mt-2 text-secondary">
              Get started by processing your first document through the Parser pipeline.
            </p>
            <Link to="/upload" className="btn btn-primary mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Process Document
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-primary-50 dark:bg-primary-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Uploaded
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-primary-800 divide-y divide-primary-200 dark:divide-primary-700">
                {documents.map((doc) => (
                  <tr key={doc.document_id} className="hover:bg-primary-50 dark:hover:bg-primary-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-muted mr-3" />
                        <div>
                          <div className="text-sm font-medium text-primary">
                            {doc.filename}
                          </div>
                          <div className="text-sm text-secondary">
                            ID: {doc.document_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDocumentTypeColor(doc.document_type)}`}>
                        {formatDocumentType(doc.document_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(doc.state)}`}>
                        {getStateIcon(doc.state)}
                        <span className="ml-1">{formatState(doc.state)}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                      {formatDate(doc.uploaded_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-4">
                        <Link
                          to={`/document/${doc.document_id}`}
                          className="text-secondary hover:text-primary transition-colors"
                        >
                          View Details
                        </Link>
                        {canDelete(doc.state) && (
                          <button
                            onClick={() => onDelete(doc.document_id)}
                            className="text-red-600 hover:text-red-500 flex items-center"
                            title="Delete document"
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
