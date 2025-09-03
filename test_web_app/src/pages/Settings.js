import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Key, Bot, Building2, Activity, RefreshCw, CheckCircle, XCircle, Server, Brain } from 'lucide-react';
import { apiService } from '../services/api';

const Settings = () => {
  const [config, setConfig] = useState({
    openai_api_key: '',
    crewai_enabled: true,
    llm_model: 'gpt-5',
    llm_temperature: 0.1,
    openai_api_key_set: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [showApiKey, setShowApiKey] = useState(false);
  const [tenantId, setTenantId] = useState(localStorage.getItem('tenantId') || '1');
  const [health, setHealth] = useState({ loading: false, api: null, ai: null, error: '' });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      console.log('Loading config...');
      const response = await fetch('/api/config');
      console.log('Load response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Loaded config data:', data);

      // Ensure the config has all necessary fields
      const fullConfig = {
        openai_api_key: data.openai_api_key || '',
        crewai_enabled: data.crewai_enabled,
        llm_model: data.llm_model,
        llm_temperature: data.llm_temperature,
        openai_api_key_set: data.openai_api_key_set,
        ...data
      };
      setConfig(fullConfig);
      setMessage('Configuration loaded successfully');
    } catch (error) {
      console.error('Failed to load config:', error);
      setMessage(`Failed to load configuration: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      console.log('Saving config:', config);

      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      console.log('Save response status:', response.status);
      const responseData = await response.json();
      console.log('Save response data:', responseData);

      if (response.ok) {
        setMessage('Configuration saved successfully!');
        // Update local state with saved values instead of reloading
        setConfig(prev => ({
          ...prev,
          ...responseData
        }));
        console.log('Updated local config with saved values');
      } else {
        setMessage(`Failed to save configuration: ${response.status} ${response.statusText}`);
        console.error('Save failed with response:', responseData);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      setMessage(`Failed to save configuration: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveTenant = () => {
    apiService.setTenantId(tenantId);
    setMessage('Tenant saved');
  };

  const checkHealth = async () => {
    setHealth((h) => ({ ...h, loading: true, error: '' }));
    try {
      const apiRes = await apiService.healthCheck();
      let aiRes;
      try { aiRes = await apiService.aiHealthCheck(); } catch (e) { aiRes = { data: { status: 'unavailable', message: 'AI unavailable' } }; }
      setHealth({ loading: false, api: apiRes.data, ai: aiRes.data, error: '' });
    } catch (e) {
      setHealth({ loading: false, api: null, ai: null, error: 'Failed to check health' });
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center space-x-2 mb-8">
        <SettingsIcon className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold text-primary">AI Configuration</h1>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.includes('success')
            ? 'status-success'
            : 'status-error'
        }`}>
          {message}
        </div>
      )}

  <div className="space-y-8">
        {/* Tenant Selection */}
        <div className="card">
          <div className="flex items-center space-x-2 mb-4">
            <Building2 className="h-5 w-5 text-accent-600 dark:text-accent-400" />
            <h2 className="text-xl font-semibold text-primary">Tenant</h2>
          </div>
          <div className="flex items-center space-x-3">
            <input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="Enter Tenant ID"
              className="input"
            />
            <button onClick={saveTenant} className="btn btn-accent">Use Tenant</button>
          </div>
        </div>

  {/* AI Configuration */}
        <div className="card">
          <div className="flex items-center space-x-2 mb-4">
            <Bot className="h-5 w-5 text-accent-600 dark:text-accent-400" />
            <h2 className="text-xl font-semibold text-primary">AI Settings</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">
                OpenAI API Key
              </label>
              <div className="flex items-center space-x-2">
                <Key className="h-4 w-4 text-muted" />
                <input
                  type={showApiKey ? "text" : "password"}
                  value={config?.openai_api_key || ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    openai_api_key: e.target.value
                  }))}
                  placeholder="Enter your OpenAI API key (sk-...)"
                  className="flex-1 input font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="btn btn-secondary"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({
                    ...prev,
                    openai_api_key: ''
                  }))}
                  className="btn btn-error"
                >
                  Clear
                </button>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted">
                  GPT-5 models provide the highest accuracy and performance for document extraction.
                </p>
                {config?.openai_api_key && config.openai_api_key.length > 10 && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    ✓ API key is set ({config.openai_api_key.length} characters)
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="label">
                LLM Model
              </label>
              <select
                value={config?.llm_model || 'gpt-5'}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  llm_model: e.target.value
                }))}
                className="select"
              >
                <option value="gpt-5">GPT-5 (Most Advanced AI)</option>
                <option value="gpt-5-nano">GPT-5 Nano (Fast & Efficient)</option>
                <option value="gpt-4o">GPT-4o (Previous Generation)</option>
                <option value="gpt-4-turbo">GPT-4 Turbo (Legacy Fast)</option>
                <option value="gpt-4">GPT-4 (Legacy Reliable)</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Basic)</option>
              </select>
              <p className="mt-2 text-xs text-muted">
                GPT-5 models provide the highest accuracy and performance for document extraction.
              </p>
            </div>

            <div>
              <label className="label">
                Temperature
              </label>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={config?.llm_temperature || 0.1}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  llm_temperature: parseFloat(e.target.value)
                }))}
                className="input"
              />
              <p className="mt-1 text-sm text-muted">
                Lower values (0.1) for consistent results, higher (1.0) for creative
              </p>
            </div>

            <div>
              <label className="label">
                CrewAI Enabled
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={config?.crewai_enabled || false}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    crewai_enabled: e.target.checked
                  }))}
                  className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-primary-300 dark:border-primary-600 rounded"
                />
                <span className="text-sm text-secondary">
                  Enable AI agent extraction
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* System Health (moved here) */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-accent-600 dark:text-accent-400" />
              <h2 className="text-xl font-semibold text-primary">System Health</h2>
            </div>
            <button onClick={checkHealth} className="btn btn-secondary" disabled={health.loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${health.loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          {health.loading ? (
            <div className="flex items-center text-secondary"><RefreshCw className="h-4 w-4 animate-spin mr-2"/> Checking...</div>
          ) : health.error ? (
            <div className="p-3 status-error rounded">{health.error}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded border border-primary-200 dark:border-primary-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center"><Server className="h-4 w-4 mr-2"/><span className="font-medium">API</span></div>
                  {(health.api?.status === 'healthy') ? <CheckCircle className="h-5 w-5 text-green-500"/> : <XCircle className="h-5 w-5 text-red-500"/>}
                </div>
                <div className="text-sm text-secondary">{health.api?.message || 'Status: ' + (health.api?.status || 'Unknown')}</div>
              </div>
              <div className="p-4 rounded border border-primary-200 dark:border-primary-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center"><Brain className="h-4 w-4 mr-2"/><span className="font-medium">AI</span></div>
                  {(health.ai?.status === 'available') ? <CheckCircle className="h-5 w-5 text-green-500"/> : <XCircle className="h-5 w-5 text-red-500"/>}
                </div>
                <div className="text-sm text-secondary">{health.ai?.message || 'Status: ' + (health.ai?.status || 'Unknown')}</div>
              </div>
            </div>
          )}
        </div>



  {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <div className="flex space-x-3">
            <button
              onClick={loadConfig}
              className="btn btn-secondary"
            >
              Reload Config
            </button>
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/health');
                  if (response.ok) {
                    setMessage('✅ Backend connection successful');
                  } else {
                    setMessage('❌ Backend connection failed');
                  }
                } catch (error) {
                  setMessage(`❌ Backend connection error: ${error.message}`);
                }
              }}
              className="btn btn-success"
            >
              Test Backend
            </button>
            <button
              onClick={() => {
                setConfig({
                  openai_api_key: '',
                  crewai_enabled: true,
                  llm_model: 'gpt-5',
                  llm_temperature: 0.1,
                  openai_api_key_set: false
                });
                setMessage('Settings reset to defaults');
              }}
              className="btn btn-warning"
            >
              Reset to Defaults
            </button>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={async () => {
                setSaving(true);
                try {
                  console.log('Manual save - current config:', config);
                  const response = await fetch('/api/config', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config),
                  });
                  const result = await response.json();
                  console.log('Manual save result:', result);
                  setMessage(response.ok ? 'Manual save successful!' : 'Manual save failed');
                } catch (error) {
                  console.error('Manual save error:', error);
                  setMessage('Manual save error: ' + error.message);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="btn btn-accent"
            >
              Manual Save
            </button>

            <button
              onClick={saveConfig}
              disabled={saving || !config}
              className="btn btn-accent px-6 py-3 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
