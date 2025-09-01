import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Server,
  Brain,
  Database,
  Zap
} from 'lucide-react';
import { apiService } from '../services/api';

const SystemHealth = () => {
  const [healthData, setHealthData] = useState({
    api: null,
    ai: null,
    loading: true,
    error: ''
  });

  const checkHealth = async () => {
    setHealthData(prev => ({ ...prev, loading: true, error: '' }));
    
    try {
      // Check API health
      const apiResponse = await apiService.healthCheck();
      
      // Check AI health
      let aiResponse = null;
      try {
        aiResponse = await apiService.aiHealthCheck();
      } catch (err) {
        console.warn('AI health check failed:', err);
        aiResponse = { data: { status: 'unavailable', message: 'AI service unavailable' } };
      }
      
      setHealthData({
        api: apiResponse.data,
        ai: aiResponse.data,
        loading: false,
        error: ''
      });
    } catch (err) {
      setHealthData(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to check system health'
      }));
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
      case 'available':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'degraded':
        return <XCircle className="h-6 w-6 text-yellow-500" />;
      case 'unavailable':
      case 'unhealthy':
        return <XCircle className="h-6 w-6 text-red-500" />;
      default:
        return <Activity className="h-6 w-6 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
      case 'available':
        return 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900';
      case 'degraded':
        return 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900';
      case 'unavailable':
      case 'unhealthy':
        return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900';
      default:
        return 'border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-800';
    }
  };

  if (healthData.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-500" />
        <span className="ml-2 text-secondary">Checking system health...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary">System Health</h1>
          <p className="mt-2 text-secondary">
            Monitor the status of all system components
          </p>
        </div>
        
        <button
          onClick={checkHealth}
          disabled={healthData.loading}
          className="btn btn-secondary"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${healthData.loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {healthData.error && (
        <div className="mb-6 p-4 status-error rounded-lg">
          <p>{healthData.error}</p>
        </div>
      )}

      {/* Overall Status */}
      <div className="card mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-accent-500 mr-4" />
            <div>
              <h2 className="text-xl font-semibold text-primary">Overall Status</h2>
              <p className="text-secondary">DER Pipeline System</p>
            </div>
          </div>
          
          <div className="flex items-center">
            {healthData.api?.status === 'healthy' && healthData.ai?.status === 'available' ? (
              <>
                <CheckCircle className="h-8 w-8 text-green-500 mr-2" />
                <span className="text-lg font-medium text-green-700 dark:text-green-300">All Systems Operational</span>
              </>
            ) : (
              <>
                <XCircle className="h-8 w-8 text-red-500 mr-2" />
                <span className="text-lg font-medium text-red-700 dark:text-red-300">Issues Detected</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Service Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* API Service */}
        <div className={`card border-2 ${getStatusColor(healthData.api?.status)}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Server className="h-6 w-6 text-primary mr-3" />
              <h3 className="text-lg font-semibold text-primary">API Service</h3>
            </div>
            {getStatusIcon(healthData.api?.status)}
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-secondary">Status:</span>
              <span className="text-sm font-medium">{healthData.api?.status || 'Unknown'}</span>
            </div>
            
            {healthData.api?.version && (
              <div className="flex justify-between">
                <span className="text-sm text-secondary">Version:</span>
                <span className="text-sm font-medium">{healthData.api.version}</span>
              </div>
            )}
            
            {healthData.api?.message && (
              <div className="mt-3">
                <p className="text-sm text-primary">{healthData.api.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Service */}
        <div className={`card border-2 ${getStatusColor(healthData.ai?.status)}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Brain className="h-6 w-6 text-primary mr-3" />
              <h3 className="text-lg font-semibold text-primary">AI Service</h3>
            </div>
            {getStatusIcon(healthData.ai?.status)}
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-secondary">Status:</span>
              <span className="text-sm font-medium">{healthData.ai?.status || 'Unknown'}</span>
            </div>
            
            {healthData.ai?.openai_status && (
              <div className="flex justify-between">
                <span className="text-sm text-secondary">OpenAI:</span>
                <span className="text-sm font-medium">{healthData.ai.openai_status}</span>
              </div>
            )}
            
            {healthData.ai?.crewai_status && (
              <div className="flex justify-between">
                <span className="text-sm text-secondary">CrewAI:</span>
                <span className="text-sm font-medium">{healthData.ai.crewai_status}</span>
              </div>
            )}
            
            {healthData.ai?.message && (
              <div className="mt-3">
                <p className="text-sm text-primary">{healthData.ai.message}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Service Endpoints */}
      <div className="card">
        <h3 className="text-lg font-semibold text-primary mb-6">Available Endpoints</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: 'Document Ingest', endpoint: '/api/ingest', icon: Database },
            { name: 'Human Review', endpoint: '/api/hil', icon: Brain },
            { name: 'Data Fetch', endpoint: '/api/fetch', icon: Server },
            { name: 'Reconciliation', endpoint: '/api/reconcile', icon: Zap },
            { name: 'Finalization', endpoint: '/api/finalize', icon: CheckCircle },
            { name: 'Reports', endpoint: '/api/reports', icon: Activity },
          ].map((service) => {
            const Icon = service.icon;
            return (
              <div key={service.name} className="flex items-center p-3 bg-primary-50 dark:bg-primary-700 rounded-lg">
                <Icon className="h-5 w-5 text-secondary mr-3" />
                <div>
                  <p className="text-sm font-medium text-primary">{service.name}</p>
                  <p className="text-xs text-secondary">{service.endpoint}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Test Section */}
      <div className="card mt-8">
        <h3 className="text-lg font-semibold text-primary mb-4">Quick Test</h3>
        <p className="text-secondary mb-4">
          Test the AI extraction service with sample text
        </p>
        
        <button
          onClick={async () => {
            try {
              const response = await apiService.testAiExtraction();
              alert('AI Test Result: ' + JSON.stringify(response.data, null, 2));
            } catch (err) {
              alert('AI Test Failed: ' + (err.response?.data?.detail || err.message));
            }
          }}
          className="btn btn-primary"
        >
          <Zap className="h-4 w-4 mr-2" />
          Test AI Extraction
        </button>
      </div>
    </div>
  );
};

export default SystemHealth;
