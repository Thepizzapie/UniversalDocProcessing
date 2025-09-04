import React, { useState, useEffect, useRef } from 'react';

const SchemaJsonEditor = ({ schema, onSchemaChange }) => {
  const [jsonText, setJsonText] = useState(JSON.stringify(schema, null, 2));
  const [error, setError] = useState(null);
  const isFocused = useRef(false);

  // Sync from prop only when not actively editing and text differs
  useEffect(() => {
    const nextText = JSON.stringify(schema, null, 2);
    if (!isFocused.current && nextText !== jsonText) {
      setJsonText(nextText);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

  const handleJsonChange = (value) => {
    setJsonText(value);
    // Live-validate but don't push to parent until blur/format
    try {
      JSON.parse(value);
      setError(null);
    } catch (e) {
      setError('Invalid JSON syntax');
    }
  };

  const handleBlur = () => {
    isFocused.current = false;
    try {
      const parsed = JSON.parse(jsonText);
      onSchemaChange(parsed);
      setError(null);
    } catch (e) {
      // keep error; do not push invalid schema
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonText(formatted);
      onSchemaChange(parsed);
      setError(null);
    } catch (e) {
      setError('Invalid JSON - cannot format');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h6 className="font-medium text-gray-900 dark:text-white">JSON Schema Editor</h6>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Edit the raw JSON schema directly</p>
        </div>
        <button
          onClick={formatJson}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition-colors shadow-sm"
        >
          Format JSON
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm flex items-center space-x-2">
          <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">!</span>
          </div>
          <span>{error}</span>
        </div>
      )}

      {/* JSON Editor */}
      <div className="relative">
        <div className="absolute top-3 left-3 text-xs text-gray-400 dark:text-slate-500 z-10">
          JSON Schema
        </div>
        <textarea
          value={jsonText}
          onChange={(e) => handleJsonChange(e.target.value)}
          onFocus={() => { isFocused.current = true; }}
          onBlur={handleBlur}
          className={`w-full h-80 p-4 pt-8 text-sm font-mono border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 resize-none ${
            error
              ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/10'
              : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800'
          }`}
          placeholder={`{
  "header": {
    "invoice_number": "",
    "invoice_date": "date",
    "total_amount": 0
  },
  "line_items": [
    {
      "description": "",
      "quantity": 0,
      "unit_price": 0
    }
  ]
}`}
          spellCheck={false}
        />
        <div className="absolute bottom-3 right-3 flex items-center space-x-3 text-xs text-gray-400 dark:text-slate-500">
          <span>{jsonText.split('\n').length} lines</span>
          <span>•</span>
          <span>{jsonText.length} chars</span>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="w-5 h-5 bg-accent-500 rounded-full flex items-center justify-center mt-0.5">
            <span className="text-white text-xs font-bold">💡</span>
          </div>
          <div className="text-sm text-accent-700 dark:text-accent-300">
            <p className="font-medium mb-1">JSON Schema Tips</p>
            <ul className="text-xs space-y-1 text-accent-600 dark:text-accent-400">
              <li>• Use the Format JSON button to prettify your schema</li>
              <li>• Ensure your JSON syntax is valid before proceeding</li>
              <li>• This editor uses the simplified format: values only (no metadata)</li>
              <li>• Arrays can be empty ([]) or contain record objects (e.g., a list of records)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchemaJsonEditor;
