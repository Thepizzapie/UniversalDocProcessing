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
  Tag,
  Settings,
  FileText,
  Image,
  AlertCircle,
  Check,
  X,
  Plus,
  Eye,
  Wand2,
  Clock,
  Database,
  ArrowLeft,
  Edit,
  Package
} from 'lucide-react';
import { apiService } from '../services/api';

// ===== UTILITY COMPONENTS =====

const StatusBadge = ({ status, children }) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'hil_required': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ingested': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(status)}`}>
      {children || status}
            </span>
  );
};

const ConfidenceIndicator = ({ confidence }) => {
  const percentage = Math.round((confidence || 0) * 100);
  const getColor = (conf) => {
    if (conf >= 0.9) return 'bg-green-500';
    if (conf >= 0.7) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
                 <div className="flex items-center space-x-2">
      <div className="w-16 bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${getColor(confidence)} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
            </div>
      <span className="text-xs text-gray-500">{percentage}%</span>
    </div>
  );
};

// ===== MAIN COMPONENT =====

const DocumentDetail = () => {
  const { id } = useParams();

  // ===== STATE =====
  const [document, setDocument] = useState(null);
  const [customDocType, setCustomDocType] = useState(null);
  const [extractionData, setExtractionData] = useState(null);
  const [hilData, setHilData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [submittingHil, setSubmittingHil] = useState(false);
  const [message, setMessage] = useState('');
  // HIL editor (overview-but-editable)
  const [hilEdits, setHilEdits] = useState({});
  const [hilNotes, setHilNotes] = useState('');
  const [savingHil, setSavingHil] = useState(false);

  // ===== HIL SAVE/APPROVAL FUNCTIONS =====
  const saveHilCorrections = async () => {
    if (!document?.latest_extraction) return;
    setSavingHil(true);
    try {
      const corrections = {};
      for (const [field, val] of Object.entries(hilEdits || {})) {
        corrections[field] = val;
      }
      await apiService.updateHilCorrections(id, { corrections, reviewer: 'user', notes: hilNotes || '' });
      await loadDocument();
      setMessage('Corrections saved');
    } catch (e) {
      setError(`Failed to save corrections: ${e.message}`);
    } finally {
      setSavingHil(false);
    }
  };

  const submitHilReview = async (decision) => {
    setSubmittingHil(true);
    try {
      if (Object.keys(hilEdits || {}).length > 0) {
        await saveHilCorrections();
      }
      await apiService.submitHilReview(id, {
        document_id: id,
        decision: decision === 'approve' ? 'APPROVED' : 'REJECTED',
        field_reviews: [],
        overall_comments: hilNotes || ''
      });
      await loadDocument();
      setMessage(`✅ Document ${decision === 'approve' ? 'approved' : 'rejected'} successfully`);
    } catch (err) {
      setError(`Failed to submit HIL review: ${err.message}`);
    } finally {
      setSubmittingHil(false);
    }
  };

  // ===== EFFECTS =====
  useEffect(() => {
    if (id) {
      loadDocument();
    }
  }, [id]);

  // Initialize simple hilEdits mirror of latest_extraction when in HIL
  useEffect(() => {
    if (document?.state === 'HIL_REQUIRED' && document.latest_extraction) {
      const initial = {};
      Object.entries(document.latest_extraction)
        .filter(([k]) => !k.startsWith('_'))
        .forEach(([k, fd]) => { initial[k] = fd?.value; });
      setHilEdits(initial);
    }
  }, [document?.state, document?.latest_extraction]);

  // ===== API FUNCTIONS =====
  const loadDocument = async () => {
    try {
      setLoading(true);
      setError('');

      // Load document report
      const reportResponse = await apiService.getDocumentReport(id);
      const documentData = reportResponse.data;
      setDocument(documentData);

      console.log('DocumentDetail: Loaded document:', documentData);

      // Load custom document type if specified
      if (documentData.pipeline_custom_doc_type_name) {
        try {
          const customTypesResponse = await apiService.getCustomDocTypes();
          const customTypes = customTypesResponse.data || [];
          const matchedType = customTypes.find(ct =>
            ct.name.toLowerCase() === documentData.pipeline_custom_doc_type_name.toLowerCase()
          );

          if (matchedType) {
            setCustomDocType(matchedType);
            console.log('DocumentDetail: Loaded custom doc type:', matchedType);
          } else {
            console.warn('DocumentDetail: Custom doc type not found:', documentData.pipeline_custom_doc_type_name);
          }
    } catch (err) {
          console.error('Failed to load custom doc types:', err);
        }
      }

      // Load HIL data if needed
      if (documentData.state === 'HIL_REQUIRED') {
        try {
          const hilResponse = await apiService.getHilData(id);
          setHilData(hilResponse.data);
    } catch (err) {
          console.error('Failed to load HIL data:', err);
        }
      }

    } catch (err) {
      setError('Failed to load document');
      console.error('DocumentDetail: Error loading document:', err);
    } finally {
      setLoading(false);
    }
  };

  // ===== RENDER FUNCTIONS =====

  const renderOverviewTab = () => {
    if (!document) return null;

    return (
      <div className="space-y-6">
        {/* Document Info */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <FileText className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Document Information</h3>
      </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 dark:text-slate-300 mb-2">Basic Details</h4>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Filename:</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">{document.filename}</dd>
      </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Type:</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">{document.mime_type}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Size:</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">
                    {document.content ? `${(document.content.length / 1024).toFixed(1)} KB` : 'N/A'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Status:</dt>
                  <dd><StatusBadge status={document.state}>{document.state}</StatusBadge></dd>
                </div>
              </dl>
            </div>

        <div>
              <h4 className="font-medium text-gray-700 dark:text-slate-300 mb-2">Processing Info</h4>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Uploaded:</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(document.uploaded_at).toLocaleString()}
                  </dd>
                </div>
                {document.pipeline_custom_doc_type_name && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Custom Type:</dt>
                    <dd className="text-sm font-medium text-blue-600">{document.pipeline_custom_doc_type_name}</dd>
              </div>
            )}
                {document.pipeline_step_types && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Pipeline:</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {document.pipeline_step_types.join(' → ')}
                    </dd>
              </div>
            )}
              </dl>
          </div>
          </div>
        </div>
        
        {/* Custom Document Type Info */}
        {customDocType && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Settings className="h-6 w-6 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Custom Document Type</h3>
      </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-700 dark:text-slate-300 mb-2">Configuration</h4>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Name:</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">{customDocType.name}</dd>
      </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Description:</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">{customDocType.description}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Fields:</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-white">
                      {Object.keys(customDocType.output_schema || {}).length}
                    </dd>
                  </div>
                </dl>
          </div>
          
              <div>
                <h4 className="font-medium text-gray-700 dark:text-slate-300 mb-2">Pipeline Steps</h4>
                {customDocType.pipeline_config?.steps ? (
                  <div className="space-y-2">
                    {customDocType.pipeline_config.steps.map((step, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm text-gray-700 dark:text-slate-300">
                          {step.name || step.step_type}
                        </span>
              </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No custom pipeline configured</p>
            )}
              </div>
          </div>
        </div>
      )}

        {/* Extraction Results */}
        {document.latest_extraction && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Database className="h-6 w-6 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Latest Extraction</h3>
            </div>

            <div className="space-y-4">
              {Object.entries(document.latest_extraction)
                .filter(([key]) => !key.startsWith('_'))
                .map(([fieldName, fieldData]) => {
                  const val = fieldData?.value;
                  const isArray = Array.isArray(val);
                  const isArrayOfObjects = isArray && val.every((row) => row && typeof row === 'object' && !Array.isArray(row));
                  const columns = isArrayOfObjects ? Array.from(new Set((val || []).flatMap((r) => Object.keys(r || {})))) : [];

                  return (
                    <div key={fieldName} className="border border-gray-200 dark:border-slate-600 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900 dark:text-white">{fieldName}</h4>
                          {isArray && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">{(val || []).length} items</span>
                          )}
                        </div>
                        {fieldData.confidence !== undefined && (
                          <ConfidenceIndicator confidence={fieldData.confidence} />
                        )}
                      </div>

                      {isArrayOfObjects ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm border border-gray-200 dark:border-slate-600 rounded-md">
                            <thead className="bg-gray-50 dark:bg-slate-700">
                              <tr>
                                {columns.map((col) => (
                                  <th key={col} className="px-3 py-2 text-left font-medium text-gray-700 dark:text-slate-200 border-b border-gray-200 dark:border-slate-600">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(val || []).map((row, rIdx) => (
                                <tr key={rIdx} className="odd:bg-white even:bg-gray-50 dark:odd:bg-slate-800 dark:even:bg-slate-700">
                                  {columns.map((col) => (
                                    <td key={col} className="px-3 py-2 border-b border-gray-200 dark:border-slate-600">
                                      <span className="text-sm text-gray-700 dark:text-slate-200">{String(row?.[col] ?? '')}</span>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : isArray ? (
                        <ul className="list-disc list-inside text-sm text-gray-700 dark:text-slate-300">
                          {(val || []).map((item, i) => (
                            <li key={i}>{String(item ?? '')}</li>
                          ))}
                        </ul>
                      ) : typeof val === 'object' && val !== null ? (
                        <pre className="text-xs text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-700 p-3 rounded border border-gray-200 dark:border-slate-600 overflow-auto">{JSON.stringify(val, null, 2)}</pre>
                      ) : (
                        <div className="text-sm text-gray-700 dark:text-slate-300">{String(val)}</div>
                      )}

                      {fieldData.type_hint && (
                        <div className="mt-2 text-xs text-gray-500">Type: {fieldData.type_hint}</div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPipelineTab = () => {
    if (!document) return null;

    const pipelineSteps = document.pipeline_step_types || [];
    const totalSteps = pipelineSteps.length;
    const completedSteps = pipelineSteps.filter(step => getStepCompletionStatus(step)).length;
    const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    // Check if this is a dual-package pipeline
    const isDualPackage = customDocType?.pipeline_config?.objects?.length > 1 ||
      document.pipeline_custom_doc_type_name?.includes('parent') ||
      document.pipeline_custom_doc_type_name?.includes('child');

    return (
      <div className="space-y-6">
        {/* Pipeline Overview */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Play className="h-6 w-6 text-blue-600" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pipeline Progress</h3>
              {isDualPackage && (
                <div className="flex items-center mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                    Dual Package Pipeline
                  </span>
                </div>
              )}
            </div>
            <StatusBadge status={document.state}>{document.state}</StatusBadge>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Overall Progress</span>
              <span className="text-sm text-gray-500">{completedSteps} of {totalSteps} steps</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-gray-500">0%</span>
              <span className="text-xs font-medium text-gray-700 dark:text-slate-300">{Math.round(progressPercentage)}%</span>
              <span className="text-xs text-gray-500">100%</span>
            </div>
          </div>

          {/* Pipeline Steps Summary */}
          {pipelineSteps.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {pipelineSteps.map((step, index) => {
                const isCompleted = getStepCompletionStatus(step);
                const isCurrent = getCurrentStepStatus(step);
                const stepName = getStepName(step);

                return (
                  <div key={index} className={`p-3 rounded-lg border ${
                    isCompleted
                      ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700'
                      : isCurrent
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
                        : 'bg-gray-50 border-gray-200 dark:bg-slate-700 dark:border-slate-600'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isCurrent
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-300 text-gray-600'
                      }`}>
                        {isCompleted ? <Check className="h-3 w-3" /> : index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900 dark:text-white">{stepName}</div>
                        <div className="text-xs text-gray-500">
                          {isCompleted ? 'Completed' : isCurrent ? 'In Progress' : 'Pending'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Dual Package Info */}
          {isDualPackage && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
              <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">Dual Package Processing</h4>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                This document uses a dual-package pipeline with separate parent and child data structures.
                Both packages will be processed through the HIL review stage for validation.
              </p>
            </div>
          )}
        </div>

        {/* Detailed Pipeline Timeline */}
        {pipelineSteps.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Pipeline Timeline</h3>

            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-slate-600"></div>

              <div className="space-y-8">
                {pipelineSteps.map((stepType, index) => {
                  const isCompleted = getStepCompletionStatus(stepType);
                  const isCurrent = getCurrentStepStatus(stepType);
                  const stepName = getStepName(stepType);
                  const stepDescription = getStepDescription(stepType);

                  return (
                    <div key={index} className="relative flex items-start space-x-4">
                      {/* Timeline Node */}
                      <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center border-4 ${
                        isCompleted
                          ? 'bg-green-500 border-green-200 text-white'
                          : isCurrent
                            ? 'bg-blue-500 border-blue-200 text-white animate-pulse'
                            : 'bg-gray-300 border-gray-200 text-gray-600'
                      }`}>
                        {isCompleted ? (
                          <Check className="h-5 w-5" />
                        ) : isCurrent ? (
                          <Play className="h-4 w-4 ml-0.5" />
                        ) : (
                          <span className="text-sm font-medium">{index + 1}</span>
                        )}
                      </div>

                      {/* Step Content */}
                      <div className="flex-1 pb-8">
                        <div className={`p-4 rounded-lg border ${
                          isCompleted
                            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700'
                            : isCurrent
                              ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
                              : 'bg-gray-50 border-gray-200 dark:bg-slate-700 dark:border-slate-600'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">{stepName}</h4>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              isCompleted
                                ? 'bg-green-100 text-green-800'
                                : isCurrent
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-600'
                            }`}>
                              {isCompleted ? '✓ Completed' : isCurrent ? '⟳ In Progress' : '○ Pending'}
                            </span>
                          </div>

                          <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">{stepDescription}</p>

                          {/* Step-specific information */}
                          {stepType === 'hil' && isDualPackage && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded p-3">
                              <div className="flex items-center space-x-2 mb-2">
                                <User className="h-4 w-4 text-yellow-600" />
                                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                  Dual Package HIL Review
                                </span>
                              </div>
                              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                This step will review both parent and child data packages separately.
                                Each package must be approved before proceeding to the next step.
                              </p>
                            </div>
                          )}

                          {isCompleted && (
                            <div className="text-xs text-green-600 dark:text-green-400 mt-2">
                              ✓ Step completed successfully
                            </div>
                          )}

                          {isCurrent && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                              ⟳ Currently processing this step...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ===== HELPER FUNCTIONS =====

  const getStepName = (stepType) => {
    const names = {
      extraction: 'Data Extraction',
      hil: 'Human Review',
      fetch: 'Data Fetching',
      reconcile: 'Data Reconciliation',
      send: 'Data Transmission'
    };
    return names[stepType] || stepType;
  };

  const getStepDescription = (stepType) => {
    const descriptions = {
      extraction: 'Extracting structured data from the document',
      hil: 'Human-in-the-loop review and validation',
      fetch: 'Fetching additional data from external sources',
      reconcile: 'Reconciling extracted data with external data',
      send: 'Transmitting processed data to destination'
    };
    return descriptions[stepType] || '';
  };

  const getStepCompletionStatus = (stepType) => {
    if (!document) return false;

    const state = document.state?.toLowerCase();
    const stepMappings = {
      extraction: ['hil_required', 'hil_confirmed', 'fetched', 'reconciled', 'approved', 'rejected'],
      hil: ['hil_confirmed', 'fetched', 'reconciled', 'approved', 'rejected'],
      fetch: ['fetched', 'reconciled', 'approved', 'rejected'],
      reconcile: ['reconciled', 'approved', 'rejected'],
      send: ['approved', 'rejected']
    };

    return stepMappings[stepType]?.includes(state) || false;
  };

  const getCurrentStepStatus = (stepType) => {
    if (!document) return false;

    const state = document.state?.toLowerCase();
    const stepMappings = {
      extraction: ['ingested'],
      hil: ['hil_required'],
      fetch: ['fetch_pending'],
      reconcile: ['fetched'],
      send: ['reconciled']
    };

    return stepMappings[stepType]?.includes(state) || false;
  };

  // ===== HIL REVIEW RENDER FUNCTION (overview-but-editable) =====
  const renderHilReviewTab = () => {
    if (!document) {
                            return (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 p-6">
          <div className="text-center">
            <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Document Not Found</h3>
            <p className="text-gray-600 dark:text-slate-400">
              Unable to load document information.
            </p>
          </div>
        </div>
      );
    }

    if (document.state === 'HIL_CONFIRMED') {
      return (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-green-200 dark:border-green-700 p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">HIL Review Completed</h3>
            <p className="text-gray-600 dark:text-slate-400">
              This document has been reviewed and approved. All pipeline steps have been completed successfully.
            </p>
                      </div>
                    </div>
                  );
    }

    if (document.state !== 'HIL_REQUIRED') {
      return (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 p-6">
          <div className="text-center">
            <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No HIL Review Required</h3>
            <p className="text-gray-600 dark:text-slate-400">
              This document is not currently in the HIL review stage or does not require manual review.
            </p>
                  </div>
        </div>
      );
    }

    const isDualPackage = customDocType?.pipeline_config?.objects?.length > 1 ||
      document.pipeline_custom_doc_type_name?.includes('parent') ||
      document.pipeline_custom_doc_type_name?.includes('child');

    return (
      <div className="space-y-6">
        {/* HIL Review Header */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-yellow-200 dark:border-yellow-700 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <User className="h-6 w-6 text-yellow-600" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Human-in-the-Loop Review</h3>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                Review the extracted data and approve or reject the processing results
              </p>
                  </div>
            {isDualPackage && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                Dual Package Review
              </span>
            )}
                </div>

          {/* Review Instructions */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">How it works</h4>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              <li>• Edit fields below, including table rows</li>
              <li>• Click Save Corrections to persist changes</li>
              <li>• Approve or Reject the entire document when done</li>
            </ul>
          </div>
              </div>
        {/* Editable Extraction (mirrors overview) */}
        {document.latest_extraction && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 p-6">
            <div className="space-y-4">
              {Object.entries(document.latest_extraction)
                .filter(([key]) => !key.startsWith('_'))
                .map(([fieldName, fieldData]) => {
                  const val = hilEdits[fieldName];
                  const isArray = Array.isArray(val);
                  const isArrayOfObjects = isArray && val.every((row) => row && typeof row === 'object' && !Array.isArray(row));
                  const setField = (updater) => setHilEdits(prev => ({ ...prev, [fieldName]: typeof updater === 'function' ? updater(prev[fieldName]) : updater }));
                  const columns = isArrayOfObjects ? Array.from(new Set((val || []).flatMap((r) => Object.keys(r || {})))) : [];

                  const typeHint = (fieldData?.type_hint || '').toLowerCase();
                  const inputType = typeHint.includes('date') ? 'date' : (typeHint.includes('number') || typeof fieldData?.value === 'number') ? 'number' : 'text';

                  return (
                    <div key={fieldName} className="border border-gray-200 dark:border-slate-600 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900 dark:text-white">{fieldName}</h4>
                          {Array.isArray(fieldData?.value) && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">{(val || []).length} items</span>
                          )}
                        </div>
                        {fieldData.confidence !== undefined && (
                          <ConfidenceIndicator confidence={fieldData.confidence} />
                        )}
                      </div>

                      {isArrayOfObjects ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm border border-gray-200 dark:border-slate-600 rounded-md">
                            <thead className="bg-gray-50 dark:bg-slate-700">
                              <tr>
                                {columns.map((col) => (
                                  <th key={col} className="px-3 py-2 text-left font-medium text-gray-700 dark:text-slate-200 border-b border-gray-200 dark:border-slate-600">{col}</th>
                                ))}
                                <th className="w-12 border-b border-gray-200 dark:border-slate-600"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {(val || []).map((row, rIdx) => (
                                <tr key={rIdx} className="odd:bg-white even:bg-gray-50 dark:odd:bg-slate-800 dark:even:bg-slate-700">
                                  {columns.map((col) => (
                                    <td key={col} className="px-3 py-2 border-b border-gray-200 dark:border-slate-600">
                                      <input
                                        className="w-full px-2 py-1 border border-gray-300 dark:border-slate-600 rounded"
                                        value={row?.[col] ?? ''}
                                        onChange={(e) => setField(prevVal => {
                                          const rows = Array.isArray(prevVal) ? [...prevVal] : [];
                                          const next = { ...(rows[rIdx] || {}) };
                                          next[col] = e.target.value;
                                          rows[rIdx] = next;
                                          return rows;
                                        })}
                                      />
                                    </td>
                                  ))}
                                  <td className="px-2 py-2 border-b border-gray-200 dark:border-slate-600 text-center">
                                    <button className="text-red-600 text-xs" onClick={() => setField((prevVal) => (prevVal || []).filter((_, i) => i !== rIdx))}>Remove</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="mt-2">
                            <button className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 border border-gray-200" onClick={() => setField([...(val || []), {}])}>Add Row</button>
                          </div>
                        </div>
                      ) : Array.isArray(val) ? (
                        <div>
                          {(val || []).map((item, i) => (
                            <div key={i} className="flex items-center gap-2 mb-2">
                              <input className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded" value={String(item ?? '')} onChange={(e) => setField(prev => { const next = Array.isArray(prev) ? [...prev] : []; next[i] = e.target.value; return next; })} />
                              <button className="text-red-600 text-xs" onClick={() => setField(prev => (prev || []).filter((_, idx) => idx !== i))}>Remove</button>
                            </div>
                          ))}
                          <button className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 border border-gray-200" onClick={() => setField([...(val || []), ''])}>Add Item</button>
                        </div>
                      ) : typeof val === 'object' && val !== null ? (
                        <textarea className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded text-xs" rows={4} value={JSON.stringify(val, null, 2)} onChange={(e) => { try { setField(JSON.parse(e.target.value)); } catch {} }} />
                      ) : (
                        <input className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded" type={inputType} value={val ?? ''} onChange={(e) => setField(inputType === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />
                      )}

                      {fieldData.type_hint && (
                        <div className="mt-2 text-xs text-gray-500">Type: {fieldData.type_hint}</div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Overall Review Actions */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Save and Decide</h3>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Reviewer Notes</label>
            <textarea className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm" rows={3} placeholder="Add overall feedback (optional)" value={hilNotes} onChange={(e) => setHilNotes(e.target.value)} />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <button onClick={saveHilCorrections} disabled={savingHil} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{savingHil ? 'Saving...' : 'Save Corrections'}</button>
            <button
              onClick={() => submitHilReview('reject')}
              disabled={submittingHil}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submittingHil ? 'Submitting...' : 'Reject Document'}
            </button>

            <button
              onClick={() => submitHilReview('approve')}
              disabled={submittingHil}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submittingHil ? 'Submitting...' : 'Approve Document'}
            </button>
                  </div>
              </div>
            </div>
    );
  };

  // ===== MAIN RENDER =====

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600 dark:text-slate-400">Loading document details...</p>
                  </div>
              </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-600" />
          <p className="text-red-600 mb-4">{error}</p>
                  <button
            onClick={() => window.history.back()}
            className="btn btn-secondary"
                  >
            Go Back
                  </button>
                </div>
              </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-8 w-8 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 dark:text-slate-400">Document not found</p>
                        </div>
                      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => window.history.back()}
            className="flex items-center space-x-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Documents</span>
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{document.filename}</h1>
              <p className="mt-2 text-gray-600 dark:text-slate-400">
                {document.pipeline_custom_doc_type_name
                  ? `Custom Type: ${document.pipeline_custom_doc_type_name}`
                  : `Document Type: ${document.document_type}`
                }
              </p>
                          </div>
            <StatusBadge status={document.state} />
                      </div>
                  </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200 dark:border-slate-700">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', name: 'Overview', icon: Eye },
                { id: 'pipeline', name: 'Pipeline', icon: Play },
                { id: 'hil', name: 'HIL Review', icon: User },
                { id: 'debug', name: 'Debug', icon: Settings }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
              </div>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'pipeline' && renderPipelineTab()}
          {activeTab === 'hil' && renderHilReviewTab()}
          {activeTab === 'debug' && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 p-6">
              <p className="text-gray-600 dark:text-slate-400">Debug information coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentDetail;