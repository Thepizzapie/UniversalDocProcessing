import React from 'react';
import { CheckCircle } from 'lucide-react';

const ReviewStep = ({ formData, editingId }) => {
  const countLeafFields = (schema) => {
    if (!schema || typeof schema !== 'object') return 0;
    let count = 0;
    Object.entries(schema).forEach(([_, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
          count += countLeafFields(v[0]);
        } else {
          // simple array value
          count += 1;
        }
      } else if (v && typeof v === 'object') {
        count += countLeafFields(v);
      } else {
        count += 1;
      }
    });
    return count;
  };

  const parentCount = countLeafFields(formData.parent_schema || (formData.output_schema || {}).parent_schema || {});
  const childCount = countLeafFields(formData.child_schema || (formData.output_schema || {}).child_schema || {});
  const totalCount = parentCount + childCount || countLeafFields(formData.output_schema || {});

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-xl font-semibold mb-2">
          {editingId ? `Ready to Update "${formData.name || 'Document Type'}"` : 'Ready to Save'}
        </h3>
        <p className="text-gray-600 dark:text-slate-300">
          {editingId ? 'Review and update your document type configuration' : 'Review your document type configuration'}
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-green-50 border-2 border-green-200 dark:bg-green-900/20 dark:border-green-800 rounded-lg p-6">
          <h4 className="font-semibold mb-3 text-green-800 dark:text-green-200">Configuration Summary</h4>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-green-200 dark:border-green-700">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Basic Information</h5>
                <p className="text-sm text-gray-600 dark:text-slate-300">
                  <strong>Name:</strong> {formData.name || 'Not set'}
                </p>
                <p className="text-sm text-gray-600 dark:text-slate-300">
                  <strong>Description:</strong> {formData.description || 'Not set'}
                </p>
                {formData.destination_webhook && (
                  <p className="text-sm text-gray-600 dark:text-slate-300">
                    <strong>Webhook:</strong> {formData.destination_webhook}
                  </p>
                )}
              </div>
              
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-green-200 dark:border-green-700">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Schema Fields</h5>
                <p className="text-sm text-gray-600 dark:text-slate-300">
                  <strong>Total Fields:</strong> {totalCount}
                </p>
                {(parentCount > 0 || childCount > 0) && (
                  <p className="text-sm text-gray-600 dark:text-slate-300">
                    <strong>Parent:</strong> {parentCount} &nbsp;•&nbsp; <strong>Child:</strong> {childCount}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-green-200 dark:border-green-700">
              <h5 className="font-medium text-gray-900 dark:text-white mb-2">Pipeline Configuration</h5>
              <p className="text-sm text-gray-600 dark:text-slate-300">
                <strong>Pipeline:</strong> {formData.pipeline_config?.name || 'Custom'}
              </p>
              <p className="text-sm text-gray-600 dark:text-slate-300">
                <strong>Steps:</strong> {(formData.pipeline_config?.steps || []).length}
              </p>
              <p className="text-sm text-gray-600 dark:text-slate-300">
                <strong>Processing:</strong> {formData.pipeline_config?.parallel_processing ? 'Parallel' : 'Sequential'}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-green-200 dark:border-green-700">
              <h5 className="font-medium text-gray-900 dark:text-white mb-2">Instructions</h5>
              <p className="text-sm text-gray-600 dark:text-slate-300">
                {formData.instructions?.prompt ? 
                  `"${formData.instructions.prompt.substring(0, 100)}${formData.instructions.prompt.length > 100 ? '...' : ''}"`
                  : 'No custom instructions provided'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white font-bold text-xs">💡</span>
            </div>
            <div>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>What happens next:</strong> After saving, you can upload documents, configure webhooks, 
                and further customize your extraction pipeline in the main interface.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewStep;
