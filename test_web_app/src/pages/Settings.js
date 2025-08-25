import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Key, Bot, FileText } from 'lucide-react';

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
  const [extractionParams, setExtractionParams] = useState({});
  const [showApiKey, setShowApiKey] = useState(false);

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
      setExtractionParams(data.extraction_parameters || {});
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
      console.log('Saving config:', {
        ...config,
        extraction_parameters: extractionParams,
      });

      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...config,
          extraction_parameters: extractionParams,
        }),
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

  const updateExtractionParam = (docType, field, value) => {
    setExtractionParams(prev => ({
      ...prev,
      [docType]: {
        ...prev[docType],
        [field]: value
      }
    }));
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
        <SettingsIcon className="h-8 w-8 text-gray-700" />
        <h1 className="text-3xl font-bold text-gray-900">AI Configuration</h1>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.includes('success')
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message}
        </div>
      )}

      <div className="space-y-8">
        {/* AI Configuration */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Bot className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">AI Settings</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OpenAI API Key
              </label>
              <div className="flex items-center space-x-2">
                <Key className="h-4 w-4 text-gray-400" />
                <input
                  type={showApiKey ? "text" : "password"}
                  value={config?.openai_api_key || ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    openai_api_key: e.target.value
                  }))}
                  placeholder="Enter your OpenAI API key (sk-...)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({
                    ...prev,
                    openai_api_key: ''
                  }))}
                  className="px-3 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Clear
                </button>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-500">
                  GPT-5 models provide the highest accuracy and performance for document extraction.
                </p>
                {config?.openai_api_key && config.openai_api_key.length > 10 && (
                  <p className="text-xs text-green-600">
                    ✓ API key is set ({config.openai_api_key.length} characters)
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LLM Model
              </label>
              <select
                value={config?.llm_model || 'gpt-5'}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  llm_model: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="gpt-5">GPT-5 (Most Advanced AI)</option>
                <option value="gpt-5-nano">GPT-5 Nano (Fast & Efficient)</option>
                <option value="gpt-4o">GPT-4o (Previous Generation)</option>
                <option value="gpt-4-turbo">GPT-4 Turbo (Legacy Fast)</option>
                <option value="gpt-4">GPT-4 (Legacy Reliable)</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Basic)</option>
              </select>
              <p className="mt-2 text-xs text-gray-500">
                GPT-5 models provide the highest accuracy and performance for document extraction.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Lower values (0.1) for consistent results, higher (1.0) for creative
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-600">
                  Enable AI agent extraction
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Document Type Settings */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <FileText className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Document Processing Settings</h2>
            <span className="text-sm text-gray-500">(Customize how each document type is processed)</span>
          </div>

          <div className="space-y-6">
            {/* Invoice Settings */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Invoices</h3>
                  <p className="text-sm text-gray-600 mb-4">Configure how invoice documents are processed and what data to extract</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        AI Processing Level
                      </label>
                      <select
                        value={extractionParams.INVOICE?.processing_level || 'standard'}
                        onChange={(e) => updateExtractionParam('INVOICE', 'processing_level', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="basic">Basic - Fast processing</option>
                        <option value="standard">Standard - Balanced</option>
                        <option value="advanced">Advanced - Highest accuracy</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Accuracy Threshold
                      </label>
                      <div className="space-y-1">
                        <input
                          type="range"
                          min="0.3"
                          max="0.9"
                          step="0.1"
                          value={extractionParams.INVOICE?.confidence_threshold || 0.7}
                          onChange={(e) => updateExtractionParam('INVOICE', 'confidence_threshold', parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Fast (70%)</span>
                          <span className="font-medium">{Math.round((extractionParams.INVOICE?.confidence_threshold || 0.7) * 100)}% Accurate</span>
                          <span>Precise (90%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Custom Instructions */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Instructions
                    </label>
                    <textarea
                      value={extractionParams.INVOICE?.custom_instructions || 'Extract all relevant information from this invoice document. Focus on key business data, amounts, dates, and vendor information.'}
                      onChange={(e) => updateExtractionParam('INVOICE', 'custom_instructions', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Enter custom instructions for AI processing..."
                    />
                  </div>

                  {/* Custom Fields Configuration */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Fields to Extract
                    </label>
                    <div className="space-y-3">
                      {(extractionParams.INVOICE?.custom_fields || [
                        { name: 'invoice_number', type: 'string', required: true, description: 'Invoice number or ID' },
                        { name: 'date', type: 'date', required: true, description: 'Invoice date' },
                        { name: 'amount', type: 'number', required: true, description: 'Total amount' },
                        { name: 'vendor', type: 'string', required: false, description: 'Vendor or supplier name' }
                      ]).map((field, index) => (
                        <div key={index} className="flex items-center space-x-2 p-3 border rounded-md">
                          <input
                            type="text"
                            placeholder="Field name"
                            value={field.name}
                            onChange={(e) => {
                              const fields = extractionParams.INVOICE?.custom_fields || [];
                              fields[index] = { ...field, name: e.target.value };
                              updateExtractionParam('INVOICE', 'custom_fields', fields);
                            }}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <select
                            value={field.type}
                            onChange={(e) => {
                              const fields = extractionParams.INVOICE?.custom_fields || [];
                              fields[index] = { ...field, type: e.target.value };
                              updateExtractionParam('INVOICE', 'custom_fields', fields);
                            }}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="string">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="boolean">Yes/No</option>
                            <option value="array">List</option>
                          </select>
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => {
                              const fields = extractionParams.INVOICE?.custom_fields || [];
                              fields[index] = { ...field, required: e.target.checked };
                              updateExtractionParam('INVOICE', 'custom_fields', fields);
                            }}
                            className="h-4 w-4 text-blue-600"
                          />
                          <span className="text-xs text-gray-600">Required</span>
                          <button
                            onClick={() => {
                              const fields = extractionParams.INVOICE?.custom_fields || [];
                              fields.splice(index, 1);
                              updateExtractionParam('INVOICE', 'custom_fields', fields);
                            }}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const fields = extractionParams.INVOICE?.custom_fields || [];
                          fields.push({ name: '', type: 'string', required: false, description: '' });
                          updateExtractionParam('INVOICE', 'custom_fields', fields);
                        }}
                        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-400 hover:text-blue-600"
                      >
                        + Add Custom Field
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Receipt Settings */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Receipts</h3>
                  <p className="text-sm text-gray-600 mb-4">Configure receipt processing settings</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        AI Processing Level
                      </label>
                      <select
                        value={extractionParams.RECEIPT?.processing_level || 'standard'}
                        onChange={(e) => updateExtractionParam('RECEIPT', 'processing_level', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="basic">Basic - Fast processing</option>
                        <option value="standard">Standard - Balanced</option>
                        <option value="advanced">Advanced - Highest accuracy</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Accuracy Threshold
                      </label>
                      <div className="space-y-1">
                        <input
                          type="range"
                          min="0.3"
                          max="0.9"
                          step="0.1"
                          value={extractionParams.RECEIPT?.confidence_threshold || 0.7}
                          onChange={(e) => updateExtractionParam('RECEIPT', 'confidence_threshold', parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Fast (70%)</span>
                          <span className="font-medium">{Math.round((extractionParams.RECEIPT?.confidence_threshold || 0.7) * 100)}% Accurate</span>
                          <span>Precise (90%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Custom Instructions */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Instructions
                    </label>
                    <textarea
                      value={extractionParams.RECEIPT?.custom_instructions || 'Extract all relevant information from this receipt. Focus on transaction details, amounts, dates, and merchant information.'}
                      onChange={(e) => updateExtractionParam('RECEIPT', 'custom_instructions', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Enter custom instructions for AI processing..."
                    />
                  </div>

                  {/* Custom Fields Configuration */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Fields to Extract
                    </label>
                    <div className="space-y-3">
                      {(extractionParams.RECEIPT?.custom_fields || [
                        { name: 'store_name', type: 'string', required: true, description: 'Store or merchant name' },
                        { name: 'date', type: 'date', required: true, description: 'Transaction date' },
                        { name: 'total_amount', type: 'number', required: true, description: 'Total amount paid' },
                        { name: 'items', type: 'array', required: false, description: 'Items purchased' }
                      ]).map((field, index) => (
                        <div key={index} className="flex items-center space-x-2 p-3 border rounded-md">
                          <input
                            type="text"
                            placeholder="Field name"
                            value={field.name}
                            onChange={(e) => {
                              const fields = extractionParams.RECEIPT?.custom_fields || [];
                              fields[index] = { ...field, name: e.target.value };
                              updateExtractionParam('RECEIPT', 'custom_fields', fields);
                            }}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <select
                            value={field.type}
                            onChange={(e) => {
                              const fields = extractionParams.RECEIPT?.custom_fields || [];
                              fields[index] = { ...field, type: e.target.value };
                              updateExtractionParam('RECEIPT', 'custom_fields', fields);
                            }}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="string">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="boolean">Yes/No</option>
                            <option value="array">List</option>
                          </select>
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => {
                              const fields = extractionParams.RECEIPT?.custom_fields || [];
                              fields[index] = { ...field, required: e.target.checked };
                              updateExtractionParam('RECEIPT', 'custom_fields', fields);
                            }}
                            className="h-4 w-4 text-blue-600"
                          />
                          <span className="text-xs text-gray-600">Required</span>
                          <button
                            onClick={() => {
                              const fields = extractionParams.RECEIPT?.custom_fields || [];
                              fields.splice(index, 1);
                              updateExtractionParam('RECEIPT', 'custom_fields', fields);
                            }}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const fields = extractionParams.RECEIPT?.custom_fields || [];
                          fields.push({ name: '', type: 'string', required: false, description: '' });
                          updateExtractionParam('RECEIPT', 'custom_fields', fields);
                        }}
                        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-400 hover:text-blue-600"
                      >
                        + Add Custom Field
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Entry/Exit Log Settings */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Entry/Exit Logs</h3>
                  <p className="text-sm text-gray-600 mb-4">Configure security/access log processing</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        AI Processing Level
                      </label>
                      <select
                        value={extractionParams.ENTRY_EXIT_LOG?.processing_level || 'standard'}
                        onChange={(e) => updateExtractionParam('ENTRY_EXIT_LOG', 'processing_level', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="basic">Basic - Fast processing</option>
                        <option value="standard">Standard - Balanced</option>
                        <option value="advanced">Advanced - Highest accuracy</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Accuracy Threshold
                      </label>
                      <div className="space-y-1">
                        <input
                          type="range"
                          min="0.3"
                          max="0.9"
                          step="0.1"
                          value={extractionParams.ENTRY_EXIT_LOG?.confidence_threshold || 0.7}
                          onChange={(e) => updateExtractionParam('ENTRY_EXIT_LOG', 'confidence_threshold', parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Fast (70%)</span>
                          <span className="font-medium">{Math.round((extractionParams.ENTRY_EXIT_LOG?.confidence_threshold || 0.7) * 100)}% Accurate</span>
                          <span>Precise (90%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Custom Instructions */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Instructions
                    </label>
                    <textarea
                      value={extractionParams.ENTRY_EXIT_LOG?.custom_instructions || 'Extract all relevant information from this access log. Focus on personnel identification, timestamps, facility details, and access patterns.'}
                      onChange={(e) => updateExtractionParam('ENTRY_EXIT_LOG', 'custom_instructions', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Enter custom instructions for AI processing..."
                    />
                  </div>

                  {/* Custom Fields Configuration */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Fields to Extract
                    </label>
                    <div className="space-y-3">
                      {(extractionParams.ENTRY_EXIT_LOG?.custom_fields || [
                        { name: 'employee_id', type: 'string', required: true, description: 'Employee or visitor ID' },
                        { name: 'name', type: 'string', required: true, description: 'Person name' },
                        { name: 'entry_time', type: 'date', required: true, description: 'Entry timestamp' },
                        { name: 'exit_time', type: 'date', required: false, description: 'Exit timestamp' },
                        { name: 'facility', type: 'string', required: false, description: 'Facility or location name' }
                      ]).map((field, index) => (
                        <div key={index} className="flex items-center space-x-2 p-3 border rounded-md">
                          <input
                            type="text"
                            placeholder="Field name"
                            value={field.name}
                            onChange={(e) => {
                              const fields = extractionParams.ENTRY_EXIT_LOG?.custom_fields || [];
                              fields[index] = { ...field, name: e.target.value };
                              updateExtractionParam('ENTRY_EXIT_LOG', 'custom_fields', fields);
                            }}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <select
                            value={field.type}
                            onChange={(e) => {
                              const fields = extractionParams.ENTRY_EXIT_LOG?.custom_fields || [];
                              fields[index] = { ...field, type: e.target.value };
                              updateExtractionParam('ENTRY_EXIT_LOG', 'custom_fields', fields);
                            }}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="string">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="boolean">Yes/No</option>
                            <option value="array">List</option>
                          </select>
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => {
                              const fields = extractionParams.ENTRY_EXIT_LOG?.custom_fields || [];
                              fields[index] = { ...field, required: e.target.checked };
                              updateExtractionParam('ENTRY_EXIT_LOG', 'custom_fields', fields);
                            }}
                            className="h-4 w-4 text-blue-600"
                          />
                          <span className="text-xs text-gray-600">Required</span>
                          <button
                            onClick={() => {
                              const fields = extractionParams.ENTRY_EXIT_LOG?.custom_fields || [];
                              fields.splice(index, 1);
                              updateExtractionParam('ENTRY_EXIT_LOG', 'custom_fields', fields);
                            }}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const fields = extractionParams.ENTRY_EXIT_LOG?.custom_fields || [];
                          fields.push({ name: '', type: 'string', required: false, description: '' });
                          updateExtractionParam('ENTRY_EXIT_LOG', 'custom_fields', fields);
                        }}
                        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-400 hover:text-blue-600"
                      >
                        + Add Custom Field
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Unknown Documents */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Unknown Documents</h3>
                  <p className="text-sm text-gray-600 mb-4">Fallback settings for unrecognized document types</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        AI Processing Level
                      </label>
                      <select
                        value={extractionParams.UNKNOWN?.processing_level || 'basic'}
                        onChange={(e) => updateExtractionParam('UNKNOWN', 'processing_level', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="basic">Basic - Simple text extraction</option>
                        <option value="standard">Standard - Pattern recognition</option>
                        <option value="advanced">Advanced - AI analysis</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Accuracy Threshold
                      </label>
                      <div className="space-y-1">
                        <input
                          type="range"
                          min="0.3"
                          max="0.9"
                          step="0.1"
                          value={extractionParams.UNKNOWN?.confidence_threshold || 0.5}
                          onChange={(e) => updateExtractionParam('UNKNOWN', 'confidence_threshold', parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Fast (50%)</span>
                          <span className="font-medium">{Math.round((extractionParams.UNKNOWN?.confidence_threshold || 0.5) * 100)}% Accurate</span>
                          <span>Precise (90%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Custom Instructions */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Instructions
                    </label>
                    <textarea
                      value={extractionParams.UNKNOWN?.custom_instructions || 'Analyze this document and extract any structured data you can identify. Look for key-value pairs, lists, dates, amounts, and important information.'}
                      onChange={(e) => updateExtractionParam('UNKNOWN', 'custom_instructions', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Enter custom instructions for AI processing..."
                    />
                  </div>

                  {/* Custom Fields Configuration */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Fields to Extract
                    </label>
                    <div className="space-y-3">
                      {(extractionParams.UNKNOWN?.custom_fields || [
                        { name: 'document_type', type: 'string', required: false, description: 'Inferred document type' },
                        { name: 'content_summary', type: 'string', required: false, description: 'Brief summary of content' },
                        { name: 'key_data', type: 'array', required: false, description: 'Important extracted data' }
                      ]).map((field, index) => (
                        <div key={index} className="flex items-center space-x-2 p-3 border rounded-md">
                          <input
                            type="text"
                            placeholder="Field name"
                            value={field.name}
                            onChange={(e) => {
                              const fields = extractionParams.UNKNOWN?.custom_fields || [];
                              fields[index] = { ...field, name: e.target.value };
                              updateExtractionParam('UNKNOWN', 'custom_fields', fields);
                            }}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <select
                            value={field.type}
                            onChange={(e) => {
                              const fields = extractionParams.UNKNOWN?.custom_fields || [];
                              fields[index] = { ...field, type: e.target.value };
                              updateExtractionParam('UNKNOWN', 'custom_fields', fields);
                            }}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="string">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="boolean">Yes/No</option>
                            <option value="array">List</option>
                          </select>
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => {
                              const fields = extractionParams.UNKNOWN?.custom_fields || [];
                              fields[index] = { ...field, required: e.target.checked };
                              updateExtractionParam('UNKNOWN', 'custom_fields', fields);
                            }}
                            className="h-4 w-4 text-blue-600"
                          />
                          <span className="text-xs text-gray-600">Required</span>
                          <button
                            onClick={() => {
                              const fields = extractionParams.UNKNOWN?.custom_fields || [];
                              fields.splice(index, 1);
                              updateExtractionParam('UNKNOWN', 'custom_fields', fields);
                            }}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const fields = extractionParams.UNKNOWN?.custom_fields || [];
                          fields.push({ name: '', type: 'string', required: false, description: '' });
                          updateExtractionParam('UNKNOWN', 'custom_fields', fields);
                        }}
                        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-400 hover:text-blue-600"
                      >
                        + Add Custom Field
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <div className="flex space-x-3">
            <button
              onClick={loadConfig}
              className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
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
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
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
              className="flex items-center space-x-2 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
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
              className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              Manual Save
            </button>

            <button
              onClick={saveConfig}
              disabled={saving || !config}
              className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
