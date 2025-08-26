import React, { useState, useEffect } from 'react';
import { Bug, Brain, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { apiService } from '../services/api';

const DebugPanel = ({ documentId, currentStage, documentData }) => {
  const [debugHistory, setDebugHistory] = useState([]);
  const [activeAnalysis, setActiveAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [docTypeOverride, setDocTypeOverride] = useState('');
  const [dryRunResult, setDryRunResult] = useState(null);

  useEffect(() => {
    if (documentId) {
      loadDebugHistory();
    }
  }, [documentId]);

  const loadDebugHistory = async () => {
    try {
      const response = await apiService.getDebugHistory(documentId);
      setDebugHistory(response.data);
    } catch (err) {
      console.error('Failed to load debug history:', err);
    }
  };

  const runDebugAnalysis = async (stage, debugType) => {
    setLoading(true);
    try {
      let response;
      const inputData = prepareInputData(stage);

      switch (stage) {
        case 'extraction':
          response = await apiService.debugExtraction(documentId, {
            debug_type: debugType,
            input_data: inputData
          });
          break;
        case 'reconciliation':
          response = await apiService.debugReconciliation(documentId, {
            debug_type: debugType,
            input_data: inputData
          });
          break;
        case 'hil':
          response = await apiService.debugHilFeedback(documentId, {
            debug_type: debugType,
            input_data: inputData
          });
          break;
        case 'performance':
          response = await apiService.debugPipelinePerformance(documentId, {
            debug_type: debugType,
            input_data: inputData
          });
          break;
        default:
          throw new Error(`Unknown debug stage: ${stage}`);
      }

      setActiveAnalysis(response.data);
      await loadDebugHistory(); // Refresh history
    } catch (err) {
      console.error(`Debug analysis failed:`, err);
    } finally {
      setLoading(false);
    }
  };

  const runDryRun = async () => {
    setLoading(true);
    setDryRunResult(null);
    try {
      const response = await apiService.dryRunExtraction(documentId, {
        document_type_override: docTypeOverride || null,
        use_vision: true,
        sample_text: null,
      });
      setDryRunResult(response.data);
    } catch (err) {
      console.error('Dry-run failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const prepareInputData = (stage) => {
    switch (stage) {
      case 'extraction':
        return {
          extracted_data: documentData?.latest_extraction || {},
          expected_fields: getExpectedFields(),
          confidence_scores: getConfidenceScores()
        };
      case 'reconciliation':
        return {
          extracted_data: documentData?.latest_extraction || {},
          fetched_data: documentData?.latest_fetch || {},
          reconciliation_result: documentData?.latest_reconciliation || {},
          strategy: documentData?.latest_reconciliation?.strategy_used || 'LOOSE'
        };
      case 'hil':
        return {
          original_extraction: documentData?.latest_extraction || {},
          hil_corrections: documentData?.latest_correction || {},
          correction_notes: 'User corrections from HIL interface'
        };
      case 'performance':
        return {
          pipeline_data: {
            state: documentData?.state,
            upload_time: documentData?.uploaded_at,
            stages_completed: getCurrentStages()
          },
          timing_data: getTimingData(),
          error_logs: 'No errors logged'
        };
      default:
        return {};
    }
  };

  const getExpectedFields = () => {
    // Return expected fields based on document type
    return ['vendor_name', 'total_amount', 'invoice_date', 'invoice_number'];
  };

  const getConfidenceScores = () => {
    const extraction = documentData?.latest_extraction || {};
    const scores = {};
    Object.keys(extraction).forEach(key => {
      scores[key] = extraction[key]?.confidence || 0.8;
    });
    return scores;
  };

  const getCurrentStages = () => {
    const stages = ['ingested'];
    if (documentData?.latest_extraction) stages.push('extracted');
    if (documentData?.latest_correction) stages.push('corrected');
    if (documentData?.latest_fetch) stages.push('fetched');
    if (documentData?.latest_reconciliation) stages.push('reconciled');
    return stages;
  };

  const getTimingData = () => {
    return {
      upload_duration: '2.3s',
      extraction_duration: '4.1s',
      hil_duration: '120s',
      fetch_duration: '1.8s',
      reconciliation_duration: '3.2s'
    };
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceIcon = (score) => {
    if (score >= 0.8) return CheckCircle;
    if (score >= 0.6) return AlertTriangle;
    return AlertTriangle;
  };

  return (
    <div className="card mt-6">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center">
          <Bug className="h-5 w-5 text-purple-500 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">AI Debugging Tools</h3>
          <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
            Beta
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </div>

      {expanded && (
        <div className="mt-6 space-y-6">
          {/* Dry-Run Extraction */}
          <div className="p-4 border border-purple-200 rounded-lg bg-purple-50">
            <div className="flex items-center justify-between">
              <div className="font-medium text-purple-900">Dry-run extraction (no DB writes)</div>
              <div className="flex items-center space-x-2">
                <select
                  className="input text-sm"
                  value={docTypeOverride}
                  onChange={(e) => setDocTypeOverride(e.target.value)}
                >
                  <option value="">Use document's type</option>
                  <option value="INVOICE">INVOICE</option>
                  <option value="RECEIPT">RECEIPT</option>
                  <option value="ENTRY_EXIT_LOG">ENTRY_EXIT_LOG</option>
                  <option value="UNKNOWN">UNKNOWN</option>
                </select>
                <button onClick={runDryRun} className="btn btn-primary" disabled={loading}>
                  Run Dry-Run
                </button>
              </div>
            </div>
            {dryRunResult && (
              <div className="mt-3 bg-white p-3 rounded border text-sm">
                <div className="mb-2 text-gray-700">
                  Used type: <span className="font-medium">{dryRunResult.used_document_type}</span>
                </div>
                <pre className="whitespace-pre-wrap text-gray-700">{JSON.stringify(dryRunResult.fields, null, 2)}</pre>
              </div>
            )}
          </div>
          {/* Quick Analysis Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => runDebugAnalysis('extraction', 'quality_check')}
              disabled={loading}
              className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
            >
              <div className="flex items-center">
                <Brain className="h-4 w-4 text-blue-500 mr-2" />
                <div>
                  <div className="font-medium text-sm">Extraction</div>
                  <div className="text-xs text-gray-500">Analyze quality</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => runDebugAnalysis('reconciliation', 'mismatch_analysis')}
              disabled={loading || !documentData?.latest_reconciliation}
              className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left disabled:opacity-50"
            >
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-orange-500 mr-2" />
                <div>
                  <div className="font-medium text-sm">Reconciliation</div>
                  <div className="text-xs text-gray-500">Find mismatches</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => runDebugAnalysis('hil', 'feedback_analysis')}
              disabled={loading || !documentData?.latest_correction}
              className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left disabled:opacity-50"
            >
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                <div>
                  <div className="font-medium text-sm">HIL Feedback</div>
                  <div className="text-xs text-gray-500">Learn patterns</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => runDebugAnalysis('performance', 'bottleneck_analysis')}
              disabled={loading}
              className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
            >
              <div className="flex items-center">
                <Clock className="h-4 w-4 text-purple-500 mr-2" />
                <div>
                  <div className="font-medium text-sm">Performance</div>
                  <div className="text-xs text-gray-500">Find bottlenecks</div>
                </div>
              </div>
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span className="ml-3 text-gray-600">Running AI analysis...</span>
            </div>
          )}

          {/* Active Analysis Results */}
          {activeAnalysis && !loading && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Brain className="h-5 w-5 text-purple-600 mr-2" />
                <h4 className="font-medium text-purple-900">
                  {activeAnalysis.debug_type.replace('_', ' ').toUpperCase()} Analysis
                </h4>
                {activeAnalysis.confidence_score && (
                  <span className={`ml-2 text-sm ${getConfidenceColor(activeAnalysis.confidence_score)}`}>
                    {Math.round(activeAnalysis.confidence_score * 100)}% confidence
                  </span>
                )}
              </div>

              {/* AI Analysis Summary */}
              {activeAnalysis.ai_analysis && (
                <div className="mb-4">
                  <h5 className="font-medium text-gray-900 mb-2">AI Analysis:</h5>
                  <div className="bg-white p-3 rounded border text-sm">
                    {typeof activeAnalysis.ai_analysis === 'object' ? (
                      <pre className="whitespace-pre-wrap text-gray-700">
                        {JSON.stringify(activeAnalysis.ai_analysis, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-gray-700">{activeAnalysis.ai_analysis}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {activeAnalysis.recommendations && activeAnalysis.recommendations.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Recommendations:</h5>
                  <ul className="space-y-1">
                    {activeAnalysis.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Debug History */}
          {debugHistory.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Recent Debug Sessions</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {debugHistory.slice(0, 5).map((session, index) => {
                  const ConfidenceIcon = getConfidenceIcon(session.confidence_score);
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <ConfidenceIcon className={`h-4 w-4 mr-2 ${getConfidenceColor(session.confidence_score)}`} />
                        <div>
                          <div className="font-medium text-sm text-gray-900">
                            {session.stage} - {session.debug_type.replace('_', ' ')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {session.recommendations?.length || 0} recommendations
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveAnalysis(session)}
                        className="text-sm text-purple-600 hover:text-purple-700"
                      >
                        View
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DebugPanel;
