import React from 'react';
import { Edit, Trash2, FileText, Plus } from 'lucide-react';

const DocTypesList = ({ docTypes, onEdit, onDelete, onCreateNew }) => {
  const countLeafFields = (schema) => {
    if (!schema || typeof schema !== 'object') return 0;
    let count = 0;
    Object.entries(schema).forEach(([_, v]) => {
      if (Array.isArray(v)) {
        if (v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
          count += countLeafFields(v[0]);
        } else {
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

  if (docTypes.length === 0) {
    return (
      <div className="text-center py-16 bg-gray-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600">
        <FileText className="h-20 w-20 mx-auto mb-4 text-gray-500 dark:text-slate-400" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Document Types</h3>
        <p className="text-gray-600 dark:text-slate-300 mb-6">Create your first document type to get started with automated extraction</p>
        <button
          onClick={onCreateNew}
          className="bg-gradient-to-r from-blue-600 to-accent-600 text-white px-8 py-3 rounded-xl flex items-center space-x-2 mx-auto hover:from-blue-700 hover:to-accent-700 transition-all shadow-lg"
        >
          <Plus className="h-5 w-5" />
          <span>Create Your First Type</span>
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {docTypes.map((docType) => {
        const parentCount = countLeafFields(docType.parent_schema || (docType.output_schema || {}).parent_schema || {});
        const childCount = countLeafFields(docType.child_schema || (docType.output_schema || {}).child_schema || {});
        const totalCount = parentCount + childCount || countLeafFields(docType.output_schema || {});

        return (
          <div key={docType.id} className="group bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden hover:border-gray-300 dark:hover:border-slate-600 hover:shadow-lg transition-all duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate mb-1">
                    {docType.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {docType.description || 'Document processing configuration'}
                  </p>
                </div>
                <div className="flex items-center space-x-2 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(docType)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    title="Edit document type"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(docType.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:text-slate-500 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete document type"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {totalCount}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider font-medium">
                    Fields
                  </div>
                </div>
                <div className="text-center border-l border-r border-gray-200 dark:border-slate-700">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {(docType.pipeline_config?.steps || []).length}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider font-medium">
                    Steps
                  </div>
                </div>
                <div className="text-center">
                  <div className="w-6 h-6 mx-auto mb-1">
                    {docType.destination_webhook ? (
                      <div className="w-full h-full bg-green-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    ) : (
                      <div className="w-full h-full border-2 border-gray-300 dark:border-slate-600 rounded-full"></div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider font-medium">
                    Webhook
                  </div>
                </div>
              </div>

              {/* Pipeline Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Pipeline</span>
                  <span className="text-sm text-gray-900 dark:text-white font-medium">
                    {docType.pipeline_config?.name || 'Custom'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Processing</span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {docType.pipeline_config?.parallel_processing ? 'Parallel' : 'Sequential'}
                  </span>
                </div>
              </div>

              {/* Edit Button */}
              <button
                onClick={() => onEdit(docType)}
                className="w-full mt-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2.5 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-50 transition-colors font-medium flex items-center justify-center space-x-2"
              >
                <Edit className="h-4 w-4" />
                <span>Configure</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DocTypesList;
