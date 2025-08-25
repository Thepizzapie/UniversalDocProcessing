import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  RefreshCw, 
  User, 
  Download, 
  GitCompare, 
  CheckCircle, 
  XCircle,
  Save,
  Play,
  Eye,
  Tag,
  Settings
} from 'lucide-react';
import { apiService } from '../services/api';
import PipelineStatus from '../components/PipelineStatus';
import DebugPanel from '../components/DebugPanel';
import RagManager from '../components/RagManager';

const DocumentDetail = () => {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('status');
  
  // HIL state
  const [hilData, setHilData] = useState(null);
  const [corrections, setCorrections] = useState({});
  const [hilLoading, setHilLoading] = useState(false);
  
  // Fetch state
  const [fetchTargets, setFetchTargets] = useState(['example_vendor']);
  const [fetchLoading, setFetchLoading] = useState(false);
  
  // Reconcile state
  const [reconcileStrategy, setReconcileStrategy] = useState('LOOSE');
  const [reconcileResult, setReconcileResult] = useState(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  
  // Finalize state
  const [finalizeDecision, setFinalizeDecision] = useState('APPROVED');
  const [finalizeNotes, setFinalizeNotes] = useState('');
  const [finalizeLoading, setFinalizeLoading] = useState(false);

  const fetchDocument = async () => {
    try {
      setLoading(true);
      const response = await apiService.getDocumentReport(id);
      setDocument(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load document');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHilData = async () => {
    try {
      const response = await apiService.getHilData(id);
      setHilData(response.data);
      
      // Initialize corrections with current extracted data
      const initialCorrections = {};
      if (response.data.extracted) {
        Object.entries(response.data.extracted).forEach(([key, field]) => {
          initialCorrections[key] = {
            value: field.value,
            confidence: field.confidence,
            type_hint: field.type_hint,
            correction_reason: null
          };
        });
      }
      setCorrections(initialCorrections);
    } catch (err) {
      console.error('Failed to fetch HIL data:', err);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDocument();
    }
  }, [id]);

  useEffect(() => {
    if (document && document.state === 'HIL_REQUIRED') {
      fetchHilData();
    }
  }, [document]);

  const handleHilUpdate = async () => {
    setHilLoading(true);
    try {
      await apiService.updateHilCorrections(id, {
        corrections,
        reviewer: 'Test User',
        notes: 'Updated via test UI'
      });
      
      // Refresh document data
      await fetchDocument();
      setActiveTab('status');
    } catch (err) {
      setError('Failed to update HIL corrections');
      console.error(err);
    } finally {
      setHilLoading(false);
    }
  };

  const handleFetch = async () => {
    setFetchLoading(true);
    try {
      await apiService.fetchComparatorData(id, { targets: fetchTargets });
      
      // Refresh document data
      setTimeout(async () => {
        await fetchDocument();
      }, 2000);
    } catch (err) {
      setError('Failed to start fetch process');
      console.error(err);
    } finally {
      setFetchLoading(false);
    }
  };

  const handleReconcile = async () => {
    setReconcileLoading(true);
    try {
      const response = await apiService.reconcileDocument(id, {
        strategy: reconcileStrategy,
        thresholds: { exact: 1.0, fuzzy: 0.85 }
      });
      
      setReconcileResult(response.data);
      await fetchDocument();
    } catch (err) {
      setError('Failed to reconcile document');
      console.error(err);
    } finally {
      setReconcileLoading(false);
    }
  };

  const handleFinalize = async () => {
    setFinalizeLoading(true);
    try {
      await apiService.finalizeDocument(id, {
        decision: finalizeDecision,
        decider: 'Test User',
        notes: finalizeNotes || null
      });
      
      await fetchDocument();
      setActiveTab('status');
    } catch (err) {
      setError('Failed to finalize document');
      console.error(err);
    } finally {
      setFinalizeLoading(false);
    }
  };

  const updateCorrection = (field, value) => {
    setCorrections(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        value,
        correction_reason: value !== hilData?.extracted?.[field]?.value ? 'Manual correction' : null
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-500" />
        <span className="ml-2 text-gray-600">Loading document...</span>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="text-center py-12">
        <XCircle className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">Document not found</h3>
      </div>
    );
  }

  const tabs = [
    { id: 'status', name: 'Pipeline Status', icon: Eye },
    { id: 'hil', name: 'Human Review', icon: User, disabled: document.state !== 'HIL_REQUIRED' },
    { id: 'fetch', name: 'Fetch Data', icon: Download, disabled: document.state !== 'HIL_CONFIRMED' },
    { id: 'reconcile', name: 'Reconcile', icon: GitCompare, disabled: document.state !== 'FETCHED' },
    { id: 'finalize', name: 'Finalize', icon: CheckCircle, disabled: document.state !== 'RECONCILED' },
    { id: 'debug', name: 'AI Debug', icon: Settings },
    { id: 'rag', name: 'Knowledge Base', icon: Tag },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{document.filename}</h1>
          <p className="mt-2 text-gray-600">Document ID: {document.document_id}</p>
        </div>
        
        <button
          onClick={fetchDocument}
          disabled={loading}
          className="btn btn-secondary"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-8">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-100 text-primary-700'
                    : tab.disabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2">
          {activeTab === 'status' && (
            <PipelineStatus currentState={document.state} document={document} />
          )}

          {activeTab === 'hil' && hilData && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Human Review</h3>
              
              <div className="space-y-4">
                {Object.entries(corrections).map(([field, data]) => (
                  <div key={field} className="border rounded-lg p-4">
                    <label className="label">{field}</label>
                    <input
                      type="text"
                      className="input"
                      value={data.value || ''}
                      onChange={(e) => updateCorrection(field, e.target.value)}
                    />
                    {data.confidence && (
                      <p className="text-sm text-gray-600 mt-1">
                        Confidence: {(data.confidence * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                ))}
                
                <button
                  onClick={handleHilUpdate}
                  disabled={hilLoading}
                  className="btn btn-primary"
                >
                  {hilLoading ? (
                    <>
                      <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Corrections
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'fetch' && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Fetch External Data</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="label">Fetch Targets</label>
                  <select
                    multiple
                    className="input"
                    value={fetchTargets}
                    onChange={(e) => setFetchTargets(Array.from(e.target.selectedOptions, option => option.value))}
                  >
                    <option value="example_vendor">Example Vendor</option>
                    <option value="external_api">External API</option>
                  </select>
                  <p className="text-sm text-gray-600 mt-1">
                    Hold Ctrl/Cmd to select multiple targets
                  </p>
                </div>
                
                <button
                  onClick={handleFetch}
                  disabled={fetchLoading}
                  className="btn btn-primary"
                >
                  {fetchLoading ? (
                    <>
                      <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Fetch
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'reconcile' && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Reconcile Data</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="label">Reconciliation Strategy</label>
                  <select
                    className="input"
                    value={reconcileStrategy}
                    onChange={(e) => setReconcileStrategy(e.target.value)}
                  >
                    <option value="STRICT">Strict Matching</option>
                    <option value="LOOSE">Loose Matching</option>
                    <option value="FUZZY">Fuzzy Matching</option>
                  </select>
                </div>
                
                <button
                  onClick={handleReconcile}
                  disabled={reconcileLoading}
                  className="btn btn-primary"
                >
                  {reconcileLoading ? (
                    <>
                      <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                      Reconciling...
                    </>
                  ) : (
                    <>
                      <GitCompare className="h-4 w-4 mr-2" />
                      Start Reconciliation
                    </>
                  )}
                </button>
                
                {reconcileResult && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">Reconciliation Results</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Overall Score: {(reconcileResult.score_overall * 100).toFixed(1)}%
                    </p>
                    <div className="space-y-2">
                      {reconcileResult.result.map((diff, index) => (
                        <div key={index} className="text-sm">
                          <span className="font-medium">{diff.field}:</span>
                          <span className={`ml-2 px-2 py-1 rounded text-xs ${
                            diff.status === 'MATCH' ? 'bg-green-100 text-green-800' :
                            diff.status === 'MISMATCH' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {diff.status}
                          </span>
                          <span className="ml-2 text-gray-600">
                            Score: {(diff.match_score * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'finalize' && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Finalize Processing</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="label">Decision</label>
                  <select
                    className="input"
                    value={finalizeDecision}
                    onChange={(e) => setFinalizeDecision(e.target.value)}
                  >
                    <option value="APPROVED">Approve</option>
                    <option value="REJECTED">Reject</option>
                  </select>
                </div>
                
                <div>
                  <label className="label">Notes (Optional)</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Add any notes about this decision..."
                    value={finalizeNotes}
                    onChange={(e) => setFinalizeNotes(e.target.value)}
                  />
                </div>
                
                <button
                  onClick={handleFinalize}
                  disabled={finalizeLoading}
                  className={`btn ${finalizeDecision === 'APPROVED' ? 'btn-success' : 'btn-error'}`}
                >
                  {finalizeLoading ? (
                    <>
                      <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {finalizeDecision === 'APPROVED' ? 
                        <CheckCircle className="h-4 w-4 mr-2" /> : 
                        <XCircle className="h-4 w-4 mr-2" />
                      }
                      {finalizeDecision === 'APPROVED' ? 'Approve' : 'Reject'} Document
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'debug' && (
            <DebugPanel 
              documentId={parseInt(id)} 
              currentStage={document.state} 
              documentData={document} 
            />
          )}

          {activeTab === 'rag' && (
            <RagManager 
              documentType={document.document_type || 'UNKNOWN'} 
            />
          )}
        </div>

        {/* Document Info Sidebar */}
        <div>
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Document Details</h3>
            
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-600">Status</dt>
                <dd className="text-sm text-gray-900">{document.state ? document.state.replace(/_/g, ' ') : 'Unknown'}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-600">Document Type</dt>
                <dd className="text-sm text-gray-900">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      document.document_type === 'INVOICE' ? 'bg-blue-100 text-blue-700' :
                      document.document_type === 'RECEIPT' ? 'bg-green-100 text-green-700' :
                      document.document_type === 'ENTRY_EXIT_LOG' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {document.document_type ? document.document_type.replace(/_/g, ' ') : 'Unknown'}
                    </span>
                    <Tag className="h-3 w-3 text-gray-400" />
                  </div>
                </dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-600">Uploaded</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(document.uploaded_at).toLocaleString()}
                </dd>
              </div>
              
              {document.latest_extraction && (
                <div>
                  <dt className="text-sm font-medium text-gray-600">Extracted Fields</dt>
                  <dd className="text-sm text-gray-900">
                    {Object.keys(document.latest_extraction).length} fields
                  </dd>
                </div>
              )}
              
              {document.final_decision && (
                <div>
                  <dt className="text-sm font-medium text-gray-600">Final Decision</dt>
                  <dd className={`text-sm font-medium ${
                    document.final_decision.decision === 'APPROVED' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {document.final_decision.decision}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {document.latest_extraction && (
            <div className="card mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Extracted Data</h3>
              
              <div className="space-y-3">
                {Object.entries(document.latest_extraction).map(([field, data]) => (
                  <div key={field}>
                    <dt className="text-sm font-medium text-gray-600">{field}</dt>
                    <dd className="text-sm text-gray-900 break-words">
                      {typeof data.value === 'object' ? JSON.stringify(data.value) : String(data.value)}
                    </dd>
                    {data.confidence && (
                      <dd className="text-xs text-gray-500">
                        Confidence: {(data.confidence * 100).toFixed(1)}%
                      </dd>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentDetail;
