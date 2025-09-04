import React, { useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { useDocTypes } from '../hooks/useDocTypes';
import { apiService } from '../services/api';
import DocTypesList from '../components/DocTypes/DocTypesList';
import CreateDocTypeWizard from '../components/DocTypes/wizard/CreateDocTypeWizard';
import { DEFAULT_FORM_DATA } from '../components/DocTypes/constants';

const DocTypesPage = () => {
  const {
    docTypes,
    message,
    tenantId,
    formData,
    setTenantId,
    loadDocTypes,
    deleteDocType,
    saveDocType,
    updateFormData,
    resetForm
  } = useDocTypes();

  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const handleCreateNew = () => {
    resetForm();
    setEditingId(null);
    setShowCreateWizard(true);
  };

  const handleEdit = (docType) => {
    console.log('Editing doc type:', docType);
    console.log('parent_schema:', docType.parent_schema);
    console.log('child_schema:', docType.child_schema);
    console.log('output_schema:', docType.output_schema);
    
    // Function to convert old metadata format to simplified format
    const convertToSimplifiedFormat = (schema) => {
      if (!schema || typeof schema !== 'object') return {};
      
      const simplified = {};
      Object.entries(schema).forEach(([fieldName, fieldDef]) => {
        if (fieldDef && typeof fieldDef === 'object' && fieldDef.type) {
          // Old metadata format - convert it
          if (fieldDef.type === 'object' && fieldDef.properties) {
            simplified[fieldName] = convertToSimplifiedFormat(fieldDef.properties);
          } else if (fieldDef.type === 'array' && fieldDef.items?.properties) {
            simplified[fieldName] = [convertToSimplifiedFormat(fieldDef.items.properties)];
          } else if (fieldDef.type === 'array') {
            simplified[fieldName] = [];
          } else if (fieldDef.type === 'string') {
            simplified[fieldName] = "";
          } else if (fieldDef.type === 'number') {
            simplified[fieldName] = 0;
          } else if (fieldDef.type === 'boolean') {
            simplified[fieldName] = false;
          } else if (fieldDef.type === 'date') {
            simplified[fieldName] = "date";
          } else {
            simplified[fieldName] = "";
          }
        } else {
          // Already simplified format
          simplified[fieldName] = fieldDef;
        }
      });
      return simplified;
    };
    
    // Determine if stored output_schema is dual (parent/child) or single-flat
    const os = docType.output_schema || {};
    const isDual = os && typeof os === 'object' && (Object.prototype.hasOwnProperty.call(os, 'parent_schema') || Object.prototype.hasOwnProperty.call(os, 'child_schema'));

    let formDataUpdate;
    if (isDual) {
      // Dual: pull parent/child from output_schema (fallback to top-level legacy fields) and keep combined output_schema
      const parentRaw = os.parent_schema || docType.parent_schema || {};
      const childRaw = os.child_schema || docType.child_schema || {};
      const parentSchema = convertToSimplifiedFormat(parentRaw);
      const childSchema = convertToSimplifiedFormat(childRaw);

      console.log('Converted parentSchema:', parentSchema);
      console.log('Converted childSchema:', childSchema);

      formDataUpdate = {
        name: docType.name,
        description: docType.description || '',
        output_schema: {
          parent_schema: parentSchema,
          child_schema: childSchema,
          collection_key: typeof os.collection_key === 'string' && os.collection_key.trim() ? os.collection_key.trim() : 'child_entries'
        },
        parent_schema: parentSchema,
        child_schema: childSchema,
        package_mode: 'two',
        instructions: docType.instructions || { prompt: '', extraction_hints: [] },
        hil_instructions: docType.hil_instructions || {
          required_review_fields: [],
          auto_approve_threshold: 0.85,
          require_manual_review: false
        },
        pipeline_config: docType.pipeline_config || DEFAULT_FORM_DATA.pipeline_config,
        destination_webhook: docType.destination_webhook || ''
      };
    } else {
      // Single-flat: keep output_schema as-is (converted), clear parent/child
      const flatSchema = convertToSimplifiedFormat(os);

      formDataUpdate = {
        name: docType.name,
        description: docType.description || '',
        output_schema: flatSchema,
        parent_schema: {},
        child_schema: {},
        package_mode: 'single',
        instructions: docType.instructions || { prompt: '', extraction_hints: [] },
        hil_instructions: docType.hil_instructions || {
          required_review_fields: [],
          auto_approve_threshold: 0.85,
          require_manual_review: false
        },
        pipeline_config: docType.pipeline_config || DEFAULT_FORM_DATA.pipeline_config,
        destination_webhook: docType.destination_webhook || ''
      };
    }
    
    console.log('Final form data update:', formDataUpdate);
    updateFormData(formDataUpdate);
    
    setEditingId(docType.id);
    setShowCreateWizard(true);
  };

  const handleWizardSave = async (editId) => {
    const success = await saveDocType(editId);
    if (success) {
      setTimeout(() => {
        setShowCreateWizard(false);
        setEditingId(null);
        resetForm();
      }, 1500);
    }
    return success;
  };

  const handleWizardCancel = () => {
    setShowCreateWizard(false);
    setEditingId(null);
    resetForm();
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-accent-600 rounded-xl flex items-center justify-center shadow-lg">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Document Types</h1>
              <p className="text-gray-600 dark:text-slate-300">Configure custom extraction templates</p>
            </div>
          </div>
          {!showCreateWizard && (
            <button
              onClick={handleCreateNew}
              className="bg-gradient-to-r from-blue-600 to-accent-600 text-white px-6 py-3 rounded-xl flex items-center space-x-2 hover:from-blue-700 hover:to-accent-700 transition-all shadow-lg"
            >
              <Plus className="h-5 w-5" />
              <span>Create New Type</span>
            </button>
          )}
        </div>

        {/* Tenant Selection */}
        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-accent-100 dark:bg-accent-900 rounded-lg flex items-center justify-center">
              <span className="text-accent-600 dark:text-accent-400 font-semibold">T</span>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200 mb-1">Current Tenant</label>
              <div className="flex items-center space-x-3">
                <input
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="Enter Tenant ID"
                  className="border-2 border-gray-300 dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:border-accent-500 focus:outline-none"
                />
                <button 
                  onClick={() => { apiService.setTenantId(tenantId); loadDocTypes(); }}
                  className="bg-accent-600 text-white px-4 py-2 rounded-lg hover:bg-accent-700 transition-colors"
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className="bg-blue-50 dark:bg-slate-800 border-l-4 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-slate-200 p-4 rounded-lg mb-8">
            {message}
          </div>
        )}

        {/* Create Wizard */}
        {showCreateWizard && (
          <CreateDocTypeWizard
            formData={formData}
            onFormDataChange={updateFormData}
            onSave={handleWizardSave}
            onCancel={handleWizardCancel}
            editingId={editingId}
          />
        )}

        {/* Document Types List */}
        {!showCreateWizard && (
          <DocTypesList
            docTypes={docTypes}
            onEdit={handleEdit}
            onDelete={deleteDocType}
            onCreateNew={handleCreateNew}
          />
        )}
      </div>
    </div>
  );
};

export default DocTypesPage;
