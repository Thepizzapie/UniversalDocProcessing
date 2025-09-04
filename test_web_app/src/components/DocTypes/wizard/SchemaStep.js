import React, { useState, useEffect } from 'react';
import { Code, FileText } from 'lucide-react';
import { SCHEMA_MODES } from '../constants';
import SchemaBuilder from '../schema/SchemaBuilder';
import SchemaJsonEditor from '../schema/SchemaJsonEditor';
import { useSchemaValidation } from '../../../hooks/useSchemaValidation';

const SchemaStep = ({ formData, onFormDataChange, packageMode = 'single' }) => {
  const [schemaMode, setSchemaMode] = useState(SCHEMA_MODES.BUILDER);
  const [schemaFields, setSchemaFields] = useState([]);
  const [parentSchemaFields, setParentSchemaFields] = useState([]);
  const [childSchemaFields, setChildSchemaFields] = useState([]);
  // Note: avoid dynamic keys to prevent input focus loss on every change
  
  const { schemaToFields, fieldsToSchema } = useSchemaValidation();

  // Initialize fields from existing schema on component mount
  useEffect(() => {
    if (packageMode === 'two') {
      // Initialize from formData only if local fields are empty (avoid wiping in-progress edits)
      if (parentSchemaFields.length === 0 && formData.parent_schema && Object.keys(formData.parent_schema).length > 0) {
        const fieldsFromSchema = schemaToFields(formData.parent_schema);
        if (fieldsFromSchema.length > 0) setParentSchemaFields(fieldsFromSchema);
      }
      if (childSchemaFields.length === 0 && formData.child_schema && Object.keys(formData.child_schema).length > 0) {
        const fieldsFromSchema = schemaToFields(formData.child_schema);
        if (fieldsFromSchema.length > 0) setChildSchemaFields(fieldsFromSchema);
      }
    } else {
      // For single package mode, use the main output_schema
      if (formData.output_schema && Object.keys(formData.output_schema).length > 0) {
        const fieldsFromSchema = schemaToFields(formData.output_schema);
        if (fieldsFromSchema.length > 0) {
          setSchemaFields(fieldsFromSchema);
        }
      }
    }
  }, [packageMode, schemaToFields]);

  // Sync fields when switching from JSON back to Builder mode
  useEffect(() => {
    if (schemaMode === SCHEMA_MODES.BUILDER) {
      if (packageMode === 'two') {
        if (formData.parent_schema && parentSchemaFields.length === 0) {
          const fieldsFromSchema = schemaToFields(formData.parent_schema);
          setParentSchemaFields(fieldsFromSchema);
        }
        if (formData.child_schema && childSchemaFields.length === 0) {
          const fieldsFromSchema = schemaToFields(formData.child_schema);
          setChildSchemaFields(fieldsFromSchema);
        }
      } else if (formData.output_schema && schemaFields.length === 0) {
        const fieldsFromSchema = schemaToFields(formData.output_schema);
        setSchemaFields(fieldsFromSchema);
      }
    }
  }, [schemaMode, packageMode, schemaToFields]);

  // Sync schema when switching from Builder to JSON mode
  useEffect(() => {
    if (schemaMode === SCHEMA_MODES.JSON) {
      if (packageMode === 'two') {
        // Push current builder fields to formData schemas for both parent and child
        const parentSchemaLatest = fieldsToSchema(parentSchemaFields || []);
        const childSchemaLatest = fieldsToSchema(childSchemaFields || []);
        onFormDataChange({
          parent_schema: parentSchemaLatest,
          child_schema: childSchemaLatest,
          output_schema: {
            parent_schema: parentSchemaLatest,
            child_schema: childSchemaLatest,
            collection_key: 'child_entries'
          }
        });
      } else {
        const schemaLatest = fieldsToSchema(schemaFields || []);
        onFormDataChange({ output_schema: schemaLatest });
      }
    }
  }, [schemaMode, packageMode, parentSchemaFields, childSchemaFields, schemaFields, fieldsToSchema, onFormDataChange]);

  const handleFieldsChange = (fields) => {
    setSchemaFields(fields);
  };

  const handleParentFieldsChange = (fields) => {
    console.log('Parent fields changed:', fields);
    setParentSchemaFields([...fields]);
    // Force component to re-render by updating parent schema
    const schema = fieldsToSchema(fields);
    onFormDataChange({ parent_schema: schema });
  };

  const handleChildFieldsChange = (fields) => {
    console.log('Child fields changed:', fields);
    setChildSchemaFields([...fields]);
    // Force component to re-render by updating child schema
    const schema = fieldsToSchema(fields);
    onFormDataChange({ child_schema: schema });
  };

  const updateInstructions = (field, value) => {
    onFormDataChange({
      instructions: {
        ...formData.instructions,
        [field]: value
      }
    });
  };

  const handleSchemaChange = (schema) => {
    if (packageMode === 'two') {
      // For dual package, this shouldn't be called directly
      // Individual parent/child handlers should be used instead
      console.warn('handleSchemaChange called in dual package mode');
    } else {
      onFormDataChange({ output_schema: schema });
      
      // If we're in JSON mode, sync the fields state for when user switches back to builder
      if (schemaMode === SCHEMA_MODES.JSON) {
        const fieldsFromSchema = schemaToFields(schema);
        setSchemaFields(fieldsFromSchema);
      }
    }
  };

  const handleParentSchemaChange = (schema) => {
    onFormDataChange({ 
      parent_schema: schema,
      output_schema: {
        ...formData.output_schema,
        parent_schema: schema,
        child_schema: formData.child_schema || {},
        collection_key: 'child_entries'
      }
    });
    
    // If we're in JSON mode, sync the fields state for when user switches back to builder
    if (schemaMode === SCHEMA_MODES.JSON) {
      const fieldsFromSchema = schemaToFields(schema);
      setParentSchemaFields(fieldsFromSchema);
    }
  };

  const handleChildSchemaChange = (schema) => {
    onFormDataChange({ 
      child_schema: schema,
      output_schema: {
        ...formData.output_schema,
        parent_schema: formData.parent_schema || {},
        child_schema: schema,
        collection_key: 'child_entries'
      }
    });
    
    // If we're in JSON mode, sync the fields state for when user switches back to builder
    if (schemaMode === SCHEMA_MODES.JSON) {
      const fieldsFromSchema = schemaToFields(schema);
      setChildSchemaFields(fieldsFromSchema);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Code className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Schema & Instructions</h3>
        <p className="text-gray-600 dark:text-slate-300">Define what to extract and how to extract it</p>
      </div>

      {/* Schema Editor */}
      <div className="bg-gray-50 dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-lg p-6">
        {/* Schema Editor Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-accent-100 dark:bg-accent-900 rounded-lg flex items-center justify-center">
              <FileText className="h-4 w-4 text-accent-600 dark:text-accent-400" />
            </div>
            <div>
              <h5 className="font-semibold text-gray-900 dark:text-white">Schema Editor</h5>
              <p className="text-sm text-gray-600 dark:text-slate-300">
                Define the structure for your document type
              </p>
            </div>
          </div>

          {/* Editor Mode Toggle */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSchemaMode(SCHEMA_MODES.BUILDER)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                schemaMode === SCHEMA_MODES.BUILDER
                  ? 'bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-300'
                  : 'text-gray-600 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Builder
            </button>
            <button
              onClick={() => setSchemaMode(SCHEMA_MODES.JSON)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                schemaMode === SCHEMA_MODES.JSON
                  ? 'bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-300'
                  : 'text-gray-600 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              JSON
            </button>
          </div>
        </div>

        {/* Schema Editor Content */}
        <div className="space-y-6">
          {packageMode === 'two' ? (
            // Dual Package Mode - Two separate schema editors
            <>
              {/* Parent Schema Editor */}
              <div className="border border-accent-200 dark:border-accent-700 rounded-lg p-4 bg-accent-50 dark:bg-accent-900/20">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-6 h-6 bg-accent-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">1</span>
                  </div>
                  <h6 className="font-semibold text-accent-700 dark:text-accent-300">Package 1 - Header/Parent Schema</h6>
                </div>
                {schemaMode === SCHEMA_MODES.BUILDER ? (
                  <SchemaBuilder
                    fields={parentSchemaFields}
                    onFieldsChange={handleParentFieldsChange}
                    onSchemaChange={handleParentSchemaChange}
                  />
                ) : (
                  <SchemaJsonEditor
                    schema={formData.parent_schema || {}}
                    onSchemaChange={handleParentSchemaChange}
                  />
                )}
              </div>

              {/* Child Schema Editor */}
              <div className="border border-blue-200 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">2</span>
                  </div>
                  <h6 className="font-semibold text-blue-700 dark:text-blue-300">Package 2 - Line Items/Child Schema</h6>
                </div>
                {schemaMode === SCHEMA_MODES.BUILDER ? (
                  <SchemaBuilder
                    fields={childSchemaFields}
                    onFieldsChange={handleChildFieldsChange}
                    onSchemaChange={handleChildSchemaChange}
                  />
                ) : (
                  <SchemaJsonEditor
                    schema={formData.child_schema || {}}
                    onSchemaChange={handleChildSchemaChange}
                  />
                )}
              </div>
            </>
          ) : (
            // Single Package Mode - One schema editor with same panel styling as dual
            <div className="border border-accent-200 dark:border-accent-700 rounded-lg p-4 bg-accent-50 dark:bg-accent-900/20">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 bg-accent-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">1</span>
                </div>
                <h6 className="font-semibold text-accent-700 dark:text-accent-300">Package - Schema</h6>
              </div>
              {schemaMode === SCHEMA_MODES.BUILDER ? (
                <SchemaBuilder
                  fields={schemaFields}
                  onFieldsChange={handleFieldsChange}
                  onSchemaChange={handleSchemaChange}
                />
              ) : (
                <SchemaJsonEditor
                  schema={formData.output_schema || {}}
                  onSchemaChange={handleSchemaChange}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Extraction Instructions */}
      <div className="border-t-2 border-gray-200 dark:border-slate-700 pt-8">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Extraction Instructions</h4>
        <div className="bg-yellow-50 border-2 border-yellow-200 dark:bg-yellow-900 dark:border-yellow-800 rounded-xl p-6">
          <div className="flex items-start space-x-3 mb-4">
            <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <div>
              <h5 className="font-semibold text-yellow-800 mb-1">AI Extraction Guidance</h5>
              <p className="text-sm text-yellow-700">
                Provide specific instructions to help AI extract data accurately, especially for handwritten documents.
              </p>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2 text-yellow-800">Extraction Prompt</label>
            <textarea
              value={formData.instructions?.prompt || ''}
              onChange={(e) => updateInstructions('prompt', e.target.value)}
              className="w-full border-2 border-yellow-300 p-4 rounded-lg h-32 focus:border-yellow-500 focus:outline-none bg-white"
              placeholder="Example: 'Extract data from handwritten expense forms. Look for employee signature at bottom-right. Amounts may be written in cursive.'"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchemaStep;
