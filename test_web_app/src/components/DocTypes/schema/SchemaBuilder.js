import React from 'react';
import { Plus, Trash2, FileText } from 'lucide-react';
import { FIELD_TYPES, NESTED_FIELD_TYPES } from '../constants';

const SchemaBuilder = ({ fields, onFieldsChange, onSchemaChange }) => {
  const addField = () => {
    const isFirstField = fields.length === 0;
    const newField = {
      id: Math.random(),
      name: isFirstField ? 'header_info' : 'line_items',
      type: isFirstField ? 'object' : 'array',
      required: false,
      description: isFirstField ? 'Header information and main document fields' : 'Table/list of items or records',
      default: '',
      nestedFields: [],
      arrayItemType: 'string'
    };
    const updatedFields = [...fields, newField];
    onFieldsChange(updatedFields);
    updateSchemaFromFields(updatedFields);
  };

  const updateField = (fieldId, property, value) => {
    const updatedFields = fields.map(field =>
      field.id === fieldId ? { ...field, [property]: value } : field
    );
    onFieldsChange(updatedFields);
    updateSchemaFromFields(updatedFields);
  };

  const removeField = (fieldId) => {
    const updatedFields = fields.filter(field => field.id !== fieldId);
    onFieldsChange(updatedFields);
    updateSchemaFromFields(updatedFields);
  };

  const addNestedField = (fieldId) => {
    console.log('Button clicked for fieldId:', fieldId);
    const updatedFields = fields.map(field => {
      if (field.id === fieldId) {
        const newNestedField = {
          id: `nested_${Date.now()}_${Math.random()}`,
          name: '',
          type: 'string',
          required: false,
          description: '',
          default: ''
        };
        return { 
          ...field, 
          nestedFields: [...(field.nestedFields || []), newNestedField] 
        };
      }
      return field;
    });
    // Deep clone to force React update on all nested arrays
    const clonedFields = updatedFields.map(f => ({
      ...f,
      nestedFields: [...(f.nestedFields || [])]
    }));
    console.log('Calling onFieldsChange with:', clonedFields);
    onFieldsChange(clonedFields);
    updateSchemaFromFields(clonedFields);
  };

  const updateNestedField = (fieldId, nestedFieldId, property, value) => {
    const updatedFields = fields.map(field => {
      if (field.id === fieldId) {
        const updatedNestedFields = field.nestedFields?.map(nestedField =>
          nestedField.id === nestedFieldId ? { ...nestedField, [property]: value } : nestedField
        ) || [];
        return { ...field, nestedFields: updatedNestedFields };
      }
      return field;
    });
    const clonedFields = updatedFields.map(f => ({
      ...f,
      nestedFields: [...(f.nestedFields || [])]
    }));
    onFieldsChange(clonedFields);
    updateSchemaFromFields(clonedFields);
  };

  const removeNestedField = (fieldId, nestedFieldId) => {
    const updatedFields = fields.map(field => {
      if (field.id === fieldId) {
        const updatedNestedFields = field.nestedFields?.filter(
          nestedField => nestedField.id !== nestedFieldId
        ) || [];
        return { ...field, nestedFields: updatedNestedFields };
      }
      return field;
    });
    const clonedFields = updatedFields.map(f => ({
      ...f,
      nestedFields: [...(f.nestedFields || [])]
    }));
    onFieldsChange(clonedFields);
    updateSchemaFromFields(clonedFields);
  };

  const updateSchemaFromFields = (fields) => {
    const buildNestedSchema = (nestedFields) => {
      const schema = {};
      nestedFields.forEach(field => {
        if (field.name && field.name.trim()) {
          // Simple schema format - just show the default value for the type
          switch (field.type) {
            case 'string':
              schema[field.name] = "";
              break;
            case 'number':
              schema[field.name] = 0;
              break;
            case 'boolean':
              schema[field.name] = false;
              break;
            case 'date':
              schema[field.name] = "date";
              break;
            default:
              schema[field.name] = "";
          }
        }
      });
      return schema;
    };

    const schema = {};
    fields.forEach(field => {
      if (field.name && field.name.trim()) {
        if (field.type === 'object' && field.nestedFields?.length > 0) {
          // For records: just the nested object
          schema[field.name] = buildNestedSchema(field.nestedFields);
        } else if (field.type === 'array') {
          if (field.nestedFields?.length > 0) {
            // For arrays: put the nested schema in an array format
            schema[field.name] = [buildNestedSchema(field.nestedFields)];
          } else {
            // Empty array
            schema[field.name] = [];
          }
        } else {
          // Simple field types
          switch (field.type) {
            case 'string':
              schema[field.name] = "";
              break;
            case 'number':
              schema[field.name] = 0;
              break;
            case 'boolean':
              schema[field.name] = false;
              break;
            case 'date':
              schema[field.name] = "date";
              break;
            default:
              schema[field.name] = "";
          }
        }
      }
    });
    onSchemaChange(schema);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h6 className="font-medium text-gray-900 dark:text-white">Schema Builder</h6>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Define the fields to extract from documents</p>
        </div>
        <button
          onClick={addField}
          className="bg-accent-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-accent-700 transition-colors flex items-center space-x-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>{fields.length === 0 ? 'Add Record' : 'Add Field'}</span>
        </button>
      </div>

      {/* Empty State */}
      {fields.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl bg-gray-50 dark:bg-slate-800/50">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No fields defined</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Create your first record to start building your dual-package schema</p>
          <button
            onClick={addField}
            className="bg-accent-600 text-white px-6 py-3 rounded-lg text-sm hover:bg-accent-700 transition-colors flex items-center space-x-2 mx-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Create First Record</span>
          </button>
        </div>
      ) : (
        /* Fields List */
        <div className="space-y-6 max-h-96 overflow-y-auto">
          {fields.map((field, index) => (
            <div key={field.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-xl p-6 shadow-sm">
              {/* Field Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-accent-100 dark:bg-accent-900 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-medium text-accent-600 dark:text-accent-400">
                      {index + 1}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {field.name || 'Unnamed Field'}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      {field.type} {field.required && '• Required'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeField(field.id)}
                  className="text-gray-400 hover:text-red-500 p-2 rounded-lg transition-colors"
                  title="Remove field"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              {/* Main Field Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Field Name *
                    </label>
                    <input
                      type="text"
                      id={`field-name-${field.id}`}
                      name={`field-name-${field.id}`}
                      value={field.name}
                      onChange={(e) => updateField(field.id, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:border-accent-500 focus:outline-none bg-white dark:bg-slate-800"
                      placeholder="e.g., invoice_number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Data Type
                    </label>
                    <select
                      id={`field-type-${field.id}`}
                      name={`field-type-${field.id}`}
                      value={field.type}
                      onChange={(e) => updateField(field.id, 'type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:border-accent-500 focus:outline-none bg-white dark:bg-slate-800"
                    >
                      {FIELD_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Description
                    </label>
                    <textarea
                      id={`field-description-${field.id}`}
                      name={`field-description-${field.id}`}
                      value={field.description}
                      onChange={(e) => updateField(field.id, 'description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:border-accent-500 focus:outline-none bg-white dark:bg-slate-800"
                      placeholder="Describe what this field contains..."
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Default Value
                    </label>
                    <input
                      type="text"
                      id={`field-default-${field.id}`}
                      name={`field-default-${field.id}`}
                      value={field.default}
                      onChange={(e) => updateField(field.id, 'default', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:border-accent-500 focus:outline-none bg-white dark:bg-slate-800"
                      placeholder="Optional default value"
                    />
                  </div>
                </div>
              </div>

              {/* Field Options */}
              <div className="flex items-center space-x-6 mb-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    id={`required-${field.id}`}
                    name={`required-${field.id}`}
                    checked={field.required}
                    onChange={(e) => updateField(field.id, 'required', e.target.checked)}
                    className="rounded border-gray-300 dark:border-slate-600 text-accent-600 focus:ring-accent-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-300">Required field</span>
                </label>
              </div>

        {/* Nested Fields for Records and Arrays */}
        {(field.type === 'array' || field.type === 'object') && (
                <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h5 className="font-medium text-gray-900 dark:text-white">
                        {field.type === 'array' ? 'Array Item Structure' : 'Record Field Structure'}
                      </h5>
                      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                        {field.type === 'array' 
                          ? 'Define fields for each item in the array/table.'
                          : 'Define the fields that make up this record.'
                        }
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addNestedField(field.id)}
                      className="bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 px-3 py-2 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors flex items-center space-x-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add {field.type === 'array' ? 'Item' : 'Record'} Field</span>
                    </button>
                  </div>
          {/* Always render the container to make the area obvious, even if empty */}
          <div className="space-y-4 pl-6 border-l-4 border-accent-200 dark:border-accent-800">
          {field.nestedFields && field.nestedFields.length > 0 && (
                    <div className="space-y-4 pl-6 border-l-4 border-accent-200 dark:border-accent-800">
                      {field.nestedFields.map((nestedField, nestedIndex) => (
                        <div key={nestedField.id} className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                              {field.type === 'array' ? 'Item' : 'Record'} Field {nestedIndex + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeNestedField(field.id, nestedField.id)}
                              className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                                Field Name
                              </label>
                              <input
                                type="text"
                                id={`nested-name-${nestedField.id}`}
                                name={`nested-name-${nestedField.id}`}
                                placeholder="field_name"
                                value={nestedField.name}
                                onChange={(e) => updateNestedField(field.id, nestedField.id, 'name', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:border-accent-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                                Type
                              </label>
                              <select
                                id={`nested-type-${nestedField.id}`}
                                name={`nested-type-${nestedField.id}`}
                                value={nestedField.type}
                                onChange={(e) => updateNestedField(field.id, nestedField.id, 'type', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:border-accent-500 focus:outline-none"
                              >
                                {NESTED_FIELD_TYPES.map(type => (
                                  <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-end">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  id={`nested-required-${nestedField.id}`}
                                  name={`nested-required-${nestedField.id}`}
                                  checked={nestedField.required}
                                  onChange={(e) => updateNestedField(field.id, nestedField.id, 'required', e.target.checked)}
                                  className="rounded border-gray-300 dark:border-slate-600 text-accent-600 focus:ring-accent-500"
                                />
                                <span className="text-xs text-gray-600 dark:text-slate-400">Required</span>
                              </label>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                                Description
                              </label>
                              <input
                                type="text"
                                id={`nested-description-${nestedField.id}`}
                                name={`nested-description-${nestedField.id}`}
                                placeholder="Field description"
                                value={nestedField.description}
                                onChange={(e) => updateNestedField(field.id, nestedField.id, 'description', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:border-accent-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                                Default Value
                              </label>
                              <input
                                type="text"
                                id={`nested-default-${nestedField.id}`}
                                name={`nested-default-${nestedField.id}`}
                                placeholder="Default value"
                                value={nestedField.default}
                                onChange={(e) => updateNestedField(field.id, nestedField.id, 'default', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:border-accent-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {(!field.nestedFields || field.nestedFields.length === 0) && (
                    <div className="text-sm text-gray-500 dark:text-slate-400 italic">No fields yet. Click "Add {field.type === 'array' ? 'Item' : 'Record'} Field" to start.</div>
                  )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SchemaBuilder;
