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
  Settings,
  Edit3,
  FileText,
  Image,
  AlertCircle,
  Check,
  X,
  Plus,
  Copy
} from 'lucide-react';
import { apiService } from '../services/api';
import PipelineStatus from '../components/PipelineStatus';
import DebugPanel from '../components/DebugPanel';
import RagManager from '../components/RagManager';

// Enhanced Extracted Data Field Component - UNUSED
/*
const ExtractedDataField = ({ field, data, isEditing, onEdit, onSave, onCancel }) => {
  const [editValue, setEditValue] = useState(data.value);
  
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50';
    if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const formatValue = (value) => {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const handleSave = () => {
    // Here you would typically save the edited value
    console.log('Saving:', field, editValue);
    onSave();
  };

  return (
    <div className="border border-gray-200 dark:border-slate-600 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <label className="font-medium text-gray-900 dark:text-white">{field}</label>
          {data.type_hint && (
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
              {data.type_hint}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {data.confidence && (
            <span className={`text-xs px-2 py-1 rounded-full ${getConfidenceColor(data.confidence)}`}>
              {(data.confidence * 100).toFixed(1)}%
            </span>
          )}
          {!isEditing && (
            <button
              onClick={onEdit}
              className="text-gray-400 hover:text-blue-600 transition-colors"
              title="Edit field"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      {isEditing ? (
        <div className="space-y-3">
          {typeof data.value === 'object' ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md font-mono text-sm h-32"
              placeholder="Enter JSON..."
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md"
            />
          )}
          <div className="flex justify-end space-x-2">
            <button
              onClick={onCancel}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          {typeof data.value === 'object' ? (
            <pre className="bg-gray-50 dark:bg-slate-800 p-2 rounded text-xs overflow-auto max-h-32">
              {formatValue(data.value)}
            </pre>
          ) : (
            <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded min-h-[2rem] flex items-center">
              {formatValue(data.value) || <span className="text-gray-400 italic">No value</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
*/

// Smart Field Editor Component - User-friendly dynamic editor
const SmartFieldEditor = ({ field, data, onUpdate }) => {
  const [editValue, setEditValue] = useState(data.value || '');
  const [correctionReason, setCorrectionReason] = useState(data.correction_reason || '');
  const [showReason, setShowReason] = useState(!!data.correction_reason);
  const [isModified, setIsModified] = useState(false);
  
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'border-green-300 bg-green-50 dark:bg-green-900/20';
    if (confidence >= 0.7) return 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20';
    return 'border-red-300 bg-red-50 dark:bg-red-900/20';
  };

     const getFieldIcon = (type, value, fieldName) => {
     // No icons - return empty string
     return '';
   };

  const detectInputType = (type, value, fieldName) => {
    const lowerField = fieldName.toLowerCase();
    const stringValue = String(value || '').toLowerCase();
    
    if (type === 'number' || typeof value === 'number') return 'number';
    if (type === 'email' || stringValue.includes('@')) return 'email';
    if (type === 'date' || stringValue.match(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}/)) return 'date';
    if (lowerField.includes('phone') || lowerField.includes('tel')) return 'tel';
    if (lowerField.includes('url') || lowerField.includes('website')) return 'url';
    if (stringValue.length > 100) return 'textarea';
    return 'text';
  };

  const handleValueChange = (newValue) => {
    setEditValue(newValue);
    setIsModified(newValue !== data.value);
  };

  const handleSave = () => {
    onUpdate({
      value: editValue,
      confidence: data.confidence,
      type_hint: data.type_hint,
      correction_reason: correctionReason || (isModified ? 'Manual correction' : null)
    });
    setIsModified(false);
  };

  const handleReset = () => {
    setEditValue(data.value || '');
    setCorrectionReason(data.correction_reason || '');
    setIsModified(false);
  };

  const inputType = detectInputType(data.type_hint, data.value, field);
  const fieldIcon = getFieldIcon(data.type_hint, data.value, field);
  
  // Generate user-friendly field label
  const getFieldLabel = (fieldName) => {
    return fieldName
      .split('.')
      .map(part => part.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1'))
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' → ');
  };

  return (
    <div className={`border rounded-lg p-4 transition-all duration-200 ${getConfidenceColor(data.confidence)} ${isModified ? 'ring-2 ring-blue-400' : ''}`}>
      {/* Compact Field Header */}
      <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center space-x-2">
           {fieldIcon && <span className="text-lg">{fieldIcon}</span>}
           <div className="flex-1">
            <label className="font-medium text-gray-900 dark:text-white text-sm">
              {getFieldLabel(field)}
            </label>
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-2">
              {data.schema_definition?.description && (
                <span className="italic">{data.schema_definition.description}</span>
              )}
              <span>Type: {data.type_hint || 'string'}</span>
              {data.schema_definition?.required && (
                <span className="text-red-500">*required</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {data.confidence && (
            <div className={`text-xs px-2 py-1 rounded font-medium ${
              data.confidence >= 0.9 ? 'bg-green-100 text-green-700' :
              data.confidence >= 0.7 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {(data.confidence * 100).toFixed(0)}%
            </div>
          )}
          
          {isModified && (
            <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded flex items-center">
              <AlertCircle className="h-3 w-3 mr-1" />
              Modified
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          {data.type_hint === 'boolean' ? (
            <div className="flex items-center space-x-2 p-3">
              <input
                type="checkbox"
                checked={editValue === true || editValue === 'true'}
                onChange={(e) => handleValueChange(e.target.checked)}
                className="w-4 h-4 text-blue-600 border border-gray-300 rounded focus:ring-blue-500"
              />
              <label className="text-sm text-gray-700 dark:text-gray-300">
                {editValue === true || editValue === 'true' ? 'Yes' : 'No'}
              </label>
            </div>
          ) : data.type_hint === 'array' ? (
            <textarea
              value={Array.isArray(editValue) ? editValue.join('\n') : editValue}
              onChange={(e) => handleValueChange(e.target.value.split('\n').filter(item => item.trim()))}
              className="w-full p-3 border border-gray-200 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
              placeholder={`Enter each item on a new line...`}
              rows={3}
            />
          ) : inputType === 'textarea' ? (
            <textarea
              value={editValue}
              onChange={(e) => handleValueChange(e.target.value)}
              className="w-full p-3 border border-gray-200 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
              placeholder={`Enter ${getFieldLabel(field).toLowerCase()}...`}
              rows={3}
            />
          ) : inputType === 'number' ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => handleValueChange(e.target.value)}
              className="w-full p-3 border border-gray-200 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
              placeholder={`Enter ${getFieldLabel(field).toLowerCase()}...`}
              step="0.01"
            />
          ) : (
            <input
              type={inputType}
              value={editValue}
              onChange={(e) => handleValueChange(e.target.value)}
              className="w-full p-3 border border-gray-200 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
              placeholder={`Enter ${getFieldLabel(field).toLowerCase()}...`}
            />
          )}
          
          {inputType === 'email' && editValue && !editValue.includes('@') && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-500">
              <AlertCircle className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <button
            onClick={() => setShowReason(!showReason)}
            className="text-xs text-gray-600 hover:text-gray-800 transition-colors flex items-center"
          >
            {showReason ? 'Hide' : 'Add'} notes
            <span className="ml-1">{showReason ? '▼' : '▶'}</span>
          </button>
          
          <div className="flex space-x-2">
            {isModified && (
              <button
                onClick={handleReset}
                className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!isModified}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              <Check className="h-3 w-3 mr-1" />
              {isModified ? 'Save' : 'Saved'}
            </button>
          </div>
        </div>
        
        {showReason && (
          <textarea
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded text-xs h-12 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Why was this field corrected? (optional)"
          />
        )}

        {data.correction_reason && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border-l-4 border-blue-400">
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Previous correction:</strong> {data.correction_reason}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// HIL Editable Field Component - UNUSED
/*
const HilEditableField = ({ field, data, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.value || '');
  const [correctionReason, setCorrectionReason] = useState(data.correction_reason || '');
  const [showReason, setShowReason] = useState(false);
  
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'border-green-200 bg-green-50 dark:bg-green-900/20';
    if (confidence >= 0.7) return 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20';
    return 'border-red-200 bg-red-50 dark:bg-red-900/20';
  };

  const handleSave = () => {
    onUpdate({
      value: editValue,
      confidence: data.confidence,
      type_hint: data.type_hint,
      correction_reason: correctionReason || 'Manual correction'
    });
    setIsEditing(false);
    setShowReason(false);
  };

  const handleCancel = () => {
    setEditValue(data.value || '');
    setCorrectionReason(data.correction_reason || '');
    setIsEditing(false);
    setShowReason(false);
  };

  const isModified = editValue !== data.value;

  return (
    <div className={`border-2 rounded-lg p-4 transition-all ${getConfidenceColor(data.confidence)} ${isModified ? 'ring-2 ring-blue-200' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <label className="font-semibold text-gray-900 dark:text-white">{field}</label>
          {data.type_hint && (
            <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
              {data.type_hint}
            </span>
          )}
          {isModified && (
            <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full flex items-center">
              <AlertCircle className="h-3 w-3 mr-1" />
              Modified
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {data.confidence && (
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Confidence: <span className="font-medium">{(data.confidence * 100).toFixed(1)}%</span>
            </div>
          )}
          
          <div className="flex space-x-1">
            {!isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Edit field"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(String(data.value));
                  }}
                  className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                  title="Copy value"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  className="p-1 text-green-600 hover:text-green-700 transition-colors"
                  title="Save changes"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={handleCancel}
                  className="p-1 text-red-600 hover:text-red-700 transition-colors"
                  title="Cancel changes"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {isEditing ? (
        <div className="space-y-3">
          {typeof data.value === 'object' ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-md font-mono text-sm h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter JSON object..."
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter value..."
            />
          )}
          
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowReason(!showReason)}
              className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              {showReason ? 'Hide' : 'Add'} correction reason
            </button>
          </div>
          
          {showReason && (
            <textarea
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm h-20"
              placeholder="Why was this field corrected? (optional)"
            />
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            {typeof data.value === 'object' ? (
              <pre className="bg-white dark:bg-slate-800 p-3 rounded border text-xs overflow-auto max-h-32">
                {JSON.stringify(data.value, null, 2)}
              </pre>
            ) : (
              <div className="p-3 bg-white dark:bg-slate-800 rounded border min-h-[2.5rem] flex items-center">
                {String(data.value) || <span className="text-gray-400 italic">No value</span>}
              </div>
            )}
          </div>
          
          {data.correction_reason && (
            <div className="text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
              <strong>Correction reason:</strong> {data.correction_reason}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
*/

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
  // const [editingField, setEditingField] = useState(null); // Unused
  const [showRawData, setShowRawData] = useState(false);
  
  // Document type schema state
  const [documentTypes, setDocumentTypes] = useState([]);
  const [currentDocTypeSchema, setCurrentDocTypeSchema] = useState(null);
  const [isLoadingDocTypes, setIsLoadingDocTypes] = useState(false);
  
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

  const loadDocumentTypes = async () => {
    if (isLoadingDocTypes) return; // Prevent multiple calls
    
    try {
      setIsLoadingDocTypes(true);
      const response = await apiService.getDocTypes();
      setDocumentTypes(response.data || []);
    } catch (err) {
      console.error('Failed to load document types:', err);
      setDocumentTypes([]);
    } finally {
      setIsLoadingDocTypes(false);
    }
  };

  // Helper function to flatten nested objects into dot-notation keys
  const flattenObject = (obj, prefix = '') => {
    const flattened = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    }
    return flattened;
  };

  // Helper function to get value from nested object using dot notation
  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  // Generate corrections based on document type schema
  const generateSchemaBasedCorrections = (extractedData, schema) => {
    const corrections = {};
    
    if (!schema) return corrections;
    
    // Flatten the extracted data
    // const flatExtracted = flattenObject(extractedData); // Unused
    
    // Process each field in the schema
    const processSchemaField = (fieldName, fieldDef, prefix = '') => {
      const fullFieldName = prefix ? `${prefix}.${fieldName}` : fieldName;
      
      if (fieldDef.type === 'object' && fieldDef.properties) {
        // Process nested object properties
        Object.entries(fieldDef.properties).forEach(([nestedName, nestedDef]) => {
          processSchemaField(nestedName, nestedDef, fullFieldName);
        });
      } else if (fieldDef.type === 'array') {
        // For arrays, create a single field that represents the array
        const extractedValue = getNestedValue(extractedData, fullFieldName);
        corrections[fullFieldName] = {
          value: extractedValue || [],
          confidence: 0.8, // Default confidence for schema fields
          type_hint: fieldDef.type,
          schema_definition: fieldDef,
            correction_reason: null
          };
      } else {
        // Simple field
        const extractedValue = getNestedValue(extractedData, fullFieldName);
        corrections[fullFieldName] = {
          value: extractedValue || '',
          confidence: 0.8, // Default confidence for schema fields
          type_hint: fieldDef.type,
          schema_definition: fieldDef,
          correction_reason: null
        };
      }
    };
    
    Object.entries(schema).forEach(([fieldName, fieldDef]) => {
      processSchemaField(fieldName, fieldDef);
    });
    
    return corrections;
  };

  const fetchHilData = async () => {
    try {
      const response = await apiService.getHilData(id);
      setHilData(response?.data || null);
      
      // Get the document type schema
      const docType = documentTypes.find(dt => dt.name === document?.document_type);
      const schema = docType?.output_schema;
      setCurrentDocTypeSchema(schema);
      
      console.log('Document Type:', document?.document_type);
      console.log('Available Document Types:', documentTypes.map(dt => dt.name));
      console.log('Found Schema:', schema);
      
      // ONLY use schema-based approach - create editable fields from schema only
      if (schema && Object.keys(schema).length > 0) {
        const extractedData = response?.data?.extracted_full || response?.data?.extracted || document?.latest_extraction || {};
        const schemaCorrections = generateSchemaBasedCorrections(extractedData, schema);
        console.log('Schema-based corrections created:', schemaCorrections);
        setCorrections(schemaCorrections);
      } else {
        console.log('No schema available for document type:', document?.document_type);
        console.log('Available document types:', documentTypes);
        setCorrections({});
      }
    } catch (err) {
      console.error('Failed to fetch HIL data:', err);
      
      // Don't retry on auth errors to prevent spam
      if (err.response?.status === 403) {
        console.error('Authentication required for HIL endpoint');
        setHilData(null);
        setCorrections({});
        return;
      }
      
      // Fallback: try to create schema-based corrections from document data
      if (document?.latest_extraction) {
        const docType = documentTypes.find(dt => dt.name === document?.document_type);
        const schema = docType?.output_schema;
        
        if (schema && Object.keys(schema).length > 0) {
          const schemaCorrections = generateSchemaBasedCorrections(document.latest_extraction, schema);
          console.log('Using schema-based fallback corrections:', schemaCorrections);
          setCorrections(schemaCorrections);
        } else {
          console.log('No schema available for fallback');
          setCorrections({});
        }
      } else {
        setCorrections({});
      }
    }
  };

  useEffect(() => {
    if (id) {
      fetchDocument();
      loadDocumentTypes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Temporarily disabled to prevent retry loops when backend is down
  // useEffect(() => {
  //   if (document && document.state === 'HIL_REQUIRED' && documentTypes.length > 0) {
  //     fetchHilData();
  //   }
  // }, [document, documentTypes]);

  // Temporarily disabled to prevent retry loops when backend is down
  // useEffect(() => {
  //   if (document && documentTypes.length > 0 && Object.keys(corrections).length === 0) {
  //     console.log('Triggering HIL data fetch for document:', document.document_type);
  //     fetchHilData();
  //   }
  // }, [document, documentTypes, corrections]);

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

  const updateCorrection = (field, value, correctionReason) => {
    setCorrections(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        value,
        correction_reason: correctionReason || (value !== hilData?.extracted?.[field]?.value ? 'Manual correction' : null)
      }
    }));
  };

  const updateDocumentType = async (newType) => {
    try {
      console.log(`Updating document ${id} type to ${newType}...`);
      await apiService.updateDocumentType(id, newType);
      console.log('Document type updated successfully');
      // Refresh the document data
      fetchDocument();
      // Don't automatically fetch HIL data to prevent retry loops
      // fetchHilData();
    } catch (err) {
      console.error('Failed to update document type:', err);
      if (err.code === 'ECONNREFUSED') {
        alert('Backend server is not running. Please start the backend server.');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-500" />
        <span className="ml-2 text-secondary">Loading document...</span>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="text-center py-12">
        <XCircle className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-4 text-lg font-medium text-primary">Document not found</h3>
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
          <h1 className="text-3xl font-bold text-primary">{document.filename}</h1>
          <p className="mt-2 text-secondary">Document ID: {document.document_id}</p>
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
        <div className="mb-6 p-4 status-error rounded-lg">
          <p>{error}</p>
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
                    ? 'bg-primary-100 dark:bg-primary-700 text-primary'
                    : tab.disabled
                    ? 'text-muted cursor-not-allowed'
                    : 'text-secondary hover:text-primary hover:bg-primary-50 dark:hover:bg-primary-700'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Document Preview */}
      {document.content && (
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-primary flex items-center">
              <Image className="h-5 w-5 mr-2" />
              Document Preview
            </h3>
          </div>
          
          <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 max-h-96 overflow-auto">
            {document.mime_type?.startsWith('image/') ? (
              <img 
                src={`data:${document.mime_type};base64,${document.content}`}
                alt={document.filename}
                className="max-w-full h-auto rounded border mx-auto"
              />
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-500">
                <FileText className="h-8 w-8 mr-2" />
                <span>Preview not available for {document.mime_type}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2">
          {activeTab === 'status' && (
            <PipelineStatus currentState={document.state} document={document} />
          )}

          {activeTab === 'hil' && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-primary flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Human Review & Corrections
                </h3>
                <div className="text-sm text-gray-500">
                  {Object.keys(corrections).length} fields to review
                  {Object.keys(corrections).length === 0 && (
                    <span className="text-red-500 ml-2">
                      (No data loaded - check console for details)
                    </span>
                  )}
                </div>
              </div>
              
              <div className="grid gap-6">
                                {(() => {
                  // Check if we have a custom document type with schema
                  const detectedType = hilData?.extracted?.document_type?.value?.toLowerCase();
                  const matchingDocType = documentTypes.find(dt => 
                    dt.name.toLowerCase().includes('receipt') || 
                    dt.name.toLowerCase().includes('purchase') ||
                    (detectedType && dt.name.toLowerCase().includes(detectedType))
                  );
                  
                  console.log('Detected type:', detectedType);
                  console.log('Matching doc type:', matchingDocType);
                  console.log('Current document type:', document?.document_type);
                  
                  // If we have a matching custom document type with schema, use it
                  if (matchingDocType && matchingDocType.output_schema && Object.keys(matchingDocType.output_schema).length > 0) {
                    const schema = matchingDocType.output_schema;
                    // Use document.latest_extraction as primary source since HIL data is null
                    const extractedData = document?.latest_extraction || hilData?.extracted_full || hilData?.extracted || {};
                    
                                         // Generate fields from the custom schema and populate with extracted data
                     const schemaFields = {};
                     console.log('Raw extracted data structure:', extractedData);
                     console.log('Schema to map:', schema);
                     
                     Object.entries(schema).forEach(([fieldName, fieldDef]) => {
                       // Look for the field in multiple places in the extracted data
                       let extractedValue = null;
                       let confidence = 0.8;
                       
                       // Smart field matching - try multiple strategies
                       const findFieldValue = (data, targetField) => {
                         // Strategy 1: Direct match in instructed_fields
                         if (data.instructed_fields?.[targetField]) {
                           const field = data.instructed_fields[targetField];
                           return { value: field.value || field, confidence: field.confidence || 0.8 };
                         }
                         
                         // Strategy 2: Direct match in all_fields  
                         if (data.all_fields?.[targetField]) {
                           const field = data.all_fields[targetField];
                           return { value: field.value || field, confidence: field.confidence || 0.8 };
                         }
                         
                         // Strategy 3: Direct match at root level
                         if (data[targetField]) {
                           const field = data[targetField];
                           return { value: field.value || field, confidence: field.confidence || 0.8 };
                         }
                         
                         // Strategy 4: Fuzzy matching with common field name variations
                         const fieldVariations = {
                           'merchant_name': ['merchant', 'store', 'vendor', 'company', 'business', 'company_name', 'store_name', 'merchant_name'],
                           'merchant_address': ['address', 'location', 'store_address', 'merchant_address', 'company_address'],
                           'transaction_date': ['date', 'transaction_date', 'purchase_date', 'receipt_date'],
                           'transaction_time': ['time', 'transaction_time', 'receipt_time'],
                           'receipt_number': ['receipt', 'number', 'receipt_number', 'invoice_number', 'transaction_id'],
                           'subtotal': ['subtotal', 'sub_total', 'amount', 'subtotal_amount'],
                           'tax_amount': ['tax', 'tax_amount', 'vat', 'sales_tax'],
                           'total_amount': ['total', 'total_amount', 'grand_total', 'final_total', 'amount_total'],
                           'currency': ['currency', 'curr', 'currency_code'],
                           'payment_method': ['payment', 'method', 'payment_method', 'payment_type', 'pay_method']
                         };
                         
                         const variations = fieldVariations[targetField] || [targetField];
                         
                         // Search in instructed_fields
                         if (data.instructed_fields) {
                           for (const variation of variations) {
                             const found = Object.keys(data.instructed_fields).find(key => 
                               key.toLowerCase().includes(variation.toLowerCase()) || 
                               variation.toLowerCase().includes(key.toLowerCase())
                             );
                             if (found) {
                               const field = data.instructed_fields[found];
                               return { value: field.value || field, confidence: field.confidence || 0.8 };
                             }
                           }
                         }
                         
                         // Search in all_fields
                         if (data.all_fields) {
                           for (const variation of variations) {
                             const found = Object.keys(data.all_fields).find(key => 
                               key.toLowerCase().includes(variation.toLowerCase()) || 
                               variation.toLowerCase().includes(key.toLowerCase())
                             );
                             if (found) {
                               const field = data.all_fields[found];
                               return { value: field.value || field, confidence: field.confidence || 0.8 };
                             }
                           }
                         }
                         
                         // Search at root level
                         for (const variation of variations) {
                           const found = Object.keys(data).find(key => 
                             key.toLowerCase().includes(variation.toLowerCase()) || 
                             variation.toLowerCase().includes(key.toLowerCase())
                           );
                           if (found) {
                             const field = data[found];
                             return { value: field.value || field, confidence: field.confidence || 0.8 };
                           }
                         }
                         
                         return null;
                       };
                       
                       const result = findFieldValue(extractedData, fieldName);
                       if (result) {
                         extractedValue = result.value;
                         confidence = result.confidence;
                       }
                       
                       console.log(`Field ${fieldName}: extracted value =`, extractedValue, `confidence =`, confidence);
                       
                       schemaFields[fieldName] = {
                         value: extractedValue || '',
                         confidence: confidence,
                         type_hint: fieldDef.type || 'string',
                         schema_definition: fieldDef
                       };
                     });
                    
                    console.log('Using custom schema fields:', schemaFields);
                    
                    return Object.entries(schemaFields).map(([field, data]) => (
                      <SmartFieldEditor
                        key={field}
                        field={field}
                        data={data}
                        onUpdate={(updatedData) => updateCorrection(field, updatedData.value, updatedData.correction_reason)}
                      />
                    ));
                  }
                  
                  // If schema-based corrections exist, show them
                  if (Object.entries(corrections).length > 0) {
                    return Object.entries(corrections).map(([field, data]) => (
                      <SmartFieldEditor
                        key={field}
                        field={field}
                        data={data}
                        onUpdate={(updatedData) => updateCorrection(field, updatedData.value, updatedData.correction_reason)}
                      />
                    ));
                  }
                  
                  // Show available document types if no schema is found
                  return (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400 mb-4">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <h4 className="text-lg font-medium mb-2">Select Document Type</h4>
                        <p className="text-sm mb-4">
                          Choose the correct document type to show the appropriate fields for editing.
                        </p>
                        
                        <div className="grid gap-2 max-w-md mx-auto">
                          {documentTypes.filter(dt => dt.output_schema && Object.keys(dt.output_schema).length > 0).map(docType => {
                            // Map custom document type names to enum values
                            const getEnumType = (name) => {
                              const lowerName = name.toLowerCase();
                              if (lowerName.includes('receipt') || lowerName.includes('purchase')) return 'RECEIPT';
                              if (lowerName.includes('invoice')) return 'INVOICE';
                              if (lowerName.includes('log') || lowerName.includes('entry')) return 'ENTRY_EXIT_LOG';
                              return 'RECEIPT'; // Default fallback
                            };
                            
                            return (
                              <button
                                key={docType.id}
                                onClick={() => {
                                  const enumType = getEnumType(docType.name);
                                  console.log('Setting document type to enum:', enumType, 'for custom type:', docType.name);
                                  updateDocumentType(enumType);
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm flex items-center justify-center"
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                {docType.name}
                              </button>
                            );
                          })}
                          
                          {documentTypes.length === 0 && (
                            <div className="text-sm text-gray-500">
                              No document types with schemas found.
                              <br />
                              <button 
                                onClick={() => window.open('/doc-types', '_blank')}
                                className="text-blue-600 hover:underline mt-2"
                              >
                                Create document types →
                              </button>
                            </div>
                    )}
                  </div>
                      </div>
                    </div>
                  );
                })()}
                
                {/* Add new field - only show if we have existing fields */}
                {Object.entries(corrections).length > 0 && (
                  <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-4 text-center">
                    <button className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
                      <Plus className="h-5 w-5 mx-auto mb-2" />
                      <div className="text-sm">Add Missing Field</div>
                    </button>
                  </div>
                )}
                
                {/* Action buttons */}
                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="flex space-x-3">
                                         <button
                       onClick={() => {
                         console.log('=== COMPREHENSIVE DEBUG INFO ===');
                         console.log('Document:', document);
                         console.log('Document Type:', document?.document_type);
                         console.log('Document Types Available:', documentTypes);
                         console.log('Current Schema:', currentDocTypeSchema);
                         console.log('HIL Data:', hilData);
                         console.log('HIL Data extracted_full:', hilData?.extracted_full);
                         console.log('HIL Data extracted:', hilData?.extracted);
                         console.log('Corrections:', corrections);
                         console.log('Document State:', document?.state);
                         console.log('Latest Extraction:', document?.latest_extraction);
                         
                         // Check if we can find a matching document type
                         const detectedType = hilData?.extracted?.document_type?.value?.toLowerCase();
                         const matchingDocType = documentTypes.find(dt => 
                           dt.name.toLowerCase().includes('receipt') || 
                           dt.name.toLowerCase().includes('purchase') ||
                           (detectedType && dt.name.toLowerCase().includes(detectedType))
                         );
                         console.log('Detected type:', detectedType);
                         console.log('Matching doc type:', matchingDocType);
                         console.log('Matching doc type schema:', matchingDocType?.output_schema);
                         
                         // Test data extraction manually
                         if (matchingDocType?.output_schema) {
                           const schema = matchingDocType.output_schema;
                           const extractedData = hilData?.extracted_full || hilData?.extracted || document?.latest_extraction || {};
                           console.log('=== MANUAL FIELD MAPPING TEST ===');
                           console.log('Schema fields:', Object.keys(schema));
                           console.log('Available extracted data keys:', Object.keys(extractedData));
                           if (extractedData.instructed_fields) console.log('instructed_fields keys:', Object.keys(extractedData.instructed_fields));
                           if (extractedData.all_fields) console.log('all_fields keys:', Object.keys(extractedData.all_fields));
                           
                           // Show all available fields for debugging
                                                    console.log('=== ALL AVAILABLE FIELDS ===');
                         console.log('FULL extractedData structure:', extractedData);
                         if (extractedData.instructed_fields) {
                           console.log('instructed_fields:', extractedData.instructed_fields);
                           console.log('instructed_fields KEYS:', Object.keys(extractedData.instructed_fields));
                         }
                         if (extractedData.all_fields) {
                           console.log('all_fields:', extractedData.all_fields);
                           console.log('all_fields KEYS:', Object.keys(extractedData.all_fields));
                         }
                         console.log('root level fields:', Object.keys(extractedData).filter(key => !['instructed_fields', 'all_fields'].includes(key)));
                         
                         // Show ALL top-level fields
                         Object.keys(extractedData).forEach(key => {
                           console.log(`Root field "${key}":`, extractedData[key]);
                         });
                           
                           Object.keys(schema).forEach(fieldName => {
                             console.log(`Looking for field "${fieldName}":`);
                             if (extractedData.instructed_fields?.[fieldName]) {
                               console.log(`  Found direct match in instructed_fields:`, extractedData.instructed_fields[fieldName]);
                             }
                             if (extractedData.all_fields?.[fieldName]) {
                               console.log(`  Found direct match in all_fields:`, extractedData.all_fields[fieldName]);
                             }
                             if (extractedData[fieldName]) {
                               console.log(`  Found direct match in root:`, extractedData[fieldName]);
                             }
                             
                             // Show fuzzy matches
                             const fieldVariations = {
                               'merchant_name': ['merchant', 'store', 'vendor', 'company', 'business'],
                               'merchant_address': ['address', 'location', 'store_address'],
                               'transaction_date': ['date', 'transaction_date', 'purchase_date'],
                               'transaction_time': ['time', 'transaction_time'],
                               'receipt_number': ['receipt', 'number', 'receipt_number', 'invoice_number'],
                               'subtotal': ['subtotal', 'sub_total', 'amount'],
                               'tax_amount': ['tax', 'tax_amount', 'vat'],
                               'total_amount': ['total', 'total_amount', 'grand_total', 'final_total'],
                               'currency': ['currency', 'curr'],
                               'payment_method': ['payment', 'method', 'payment_method', 'payment_type']
                             };
                             
                             const variations = fieldVariations[fieldName] || [fieldName];
                             console.log(`  Searching for variations:`, variations);
                             
                             if (extractedData.instructed_fields) {
                               variations.forEach(variation => {
                                 const found = Object.keys(extractedData.instructed_fields).find(key => 
                                   key.toLowerCase().includes(variation.toLowerCase()) || 
                                   variation.toLowerCase().includes(key.toLowerCase())
                                 );
                                 if (found) {
                                   console.log(`  Found fuzzy match "${found}" in instructed_fields:`, extractedData.instructed_fields[found]);
                                 }
                               });
                             }
                           });
                         }
                       }}
                       className="text-sm px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                     >
                       Full Debug
                     </button>
                    
                                         <button
                       onClick={() => {
                         console.log('Manually refreshing HIL data...');
                         console.log('Current document:', document);
                         console.log('Current hilData:', hilData);
                         console.log('Available documentTypes:', documentTypes);
                         fetchHilData();
                       }}
                       className="text-sm px-3 py-1 bg-green-100 dark:bg-green-900 rounded-md hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                     >
                       Refresh Fields
                     </button>
                    
                    <button
                      onClick={() => {
                        console.log('Forcing update to RECEIPT...');
                        updateDocumentType('RECEIPT');
                      }}
                      className="text-sm px-3 py-1 bg-orange-100 dark:bg-orange-900 rounded-md hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors"
                    >
                      Force → Receipt
                    </button>
                    
                    <button
                      onClick={() => setShowRawData(!showRawData)}
                      className="text-sm px-3 py-1 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      {showRawData ? 'Hide' : 'Show'} Raw Data
                    </button>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button className="btn btn-secondary">
                      <X className="h-4 w-4 mr-2" />
                      Reset All
                    </button>
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
                          Save All Corrections
                    </>
                  )}
                </button>
                  </div>
                </div>

                {/* Raw data viewer */}
                {showRawData && hilData.extracted_full && (
                  <div className="mt-6 border-t pt-6">
                    <h4 className="text-sm font-medium text-primary mb-3 flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      Full Extraction Data (Raw JSON)
                    </h4>
                    <pre className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg text-xs overflow-auto max-h-64 border">
                      {JSON.stringify(hilData.extracted_full, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'fetch' && (
            <div className="card">
              <h3 className="text-lg font-semibold text-primary mb-6">Fetch External Data</h3>
              
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
                  <p className="text-sm text-secondary mt-1">
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
              <h3 className="text-lg font-semibold text-primary mb-6">Reconcile Data</h3>
              
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
                  <div className="mt-6 p-4 bg-primary-50 dark:bg-primary-700 rounded-lg border border-primary-200 dark:border-primary-600">
                    <h4 className="font-medium text-primary mb-2">Reconciliation Results</h4>
                    <p className="text-sm text-secondary mb-2">
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
                          <span className="ml-2 text-secondary">
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
              <h3 className="text-lg font-semibold text-primary mb-6">Finalize Processing</h3>
              
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
            <h3 className="text-lg font-semibold text-primary mb-4">Document Details</h3>
            
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-secondary">Status</dt>
                <dd className="text-sm text-primary">{document.state ? document.state.replace(/_/g, ' ') : 'Unknown'}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-secondary">Document Type</dt>
                <dd className="text-sm text-primary">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      document.document_type === 'INVOICE' ? 'doc-type-invoice' :
                      document.document_type === 'RECEIPT' ? 'doc-type-receipt' :
                      document.document_type === 'ENTRY_EXIT_LOG' ? 'doc-type-log' :
                      'doc-type-default'
                    }`}>
                      {document.document_type ? document.document_type.replace(/_/g, ' ') : 'Unknown'}
                    </span>
                    <Tag className="h-3 w-3 text-muted" />
                  </div>
                </dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-secondary">Uploaded</dt>
                <dd className="text-sm text-primary">
                  {new Date(document.uploaded_at).toLocaleString()}
                </dd>
              </div>
              
              {document.latest_extraction && (
                <div>
                  <dt className="text-sm font-medium text-secondary">Extracted Fields</dt>
                  <dd className="text-sm text-primary">
                    {Object.keys(document.latest_extraction).length} fields
                  </dd>
                </div>
              )}
              
              {document.final_decision && (
                <div>
                  <dt className="text-sm font-medium text-secondary">Final Decision</dt>
                  <dd className={`text-sm font-medium ${
                    document.final_decision.decision === 'APPROVED' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {document.final_decision.decision}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Document Preview */}
          {document.content && (
            <div className="card mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-primary flex items-center">
                  <Image className="h-5 w-5 mr-2" />
                  Document Preview
                </h3>
              </div>
              
              <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 max-h-96 overflow-auto">
                {document.mime_type?.startsWith('image/') ? (
                  <img 
                    src={`data:${document.mime_type};base64,${document.content}`}
                    alt={document.filename}
                    className="max-w-full h-auto rounded border"
                  />
                ) : (
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    <FileText className="h-8 w-8 mr-2" />
                    <span>Preview not available for {document.mime_type}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Enhanced Extracted Data Display */}
          {document.latest_extraction && (
            <div className="card mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-primary flex items-center">
                  <Tag className="h-5 w-5 mr-2" />
                  Extracted Data
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowRawData(!showRawData)}
                    className="text-sm px-3 py-1 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    {showRawData ? 'Formatted View' : 'Raw JSON'}
                  </button>
                </div>
              </div>
              
              {showRawData ? (
                <pre className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg text-xs overflow-auto max-h-96 border">
                  {JSON.stringify(document.latest_extraction, null, 2)}
                </pre>
              ) : (
              <div className="space-y-3">
                {Object.entries(document.latest_extraction).map(([field, data]) => (
                    <div key={field} className="border border-gray-200 dark:border-slate-600 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <label className="font-medium text-gray-900 dark:text-white text-sm">{field}</label>
                          {data.type_hint && (
                            <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                              {data.type_hint}
                            </span>
                          )}
                        </div>
                    {data.confidence && (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            data.confidence >= 0.9 ? 'text-green-600 bg-green-50 dark:bg-green-900/20' :
                            data.confidence >= 0.7 ? 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' :
                            'text-red-600 bg-red-50 dark:bg-red-900/20'
                          }`}>
                            {(data.confidence * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        {typeof data.value === 'object' ? (
                          <pre className="bg-gray-50 dark:bg-slate-800 p-2 rounded text-xs overflow-auto max-h-24 break-all">
                            {JSON.stringify(data.value, null, 2)}
                          </pre>
                        ) : (
                          <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded min-h-[1.5rem] flex items-center break-all">
                            {String(data.value) || <span className="text-gray-400 italic">No value</span>}
                          </div>
                        )}
                      </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentDetail;
