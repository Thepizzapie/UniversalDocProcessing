import React from 'react';
import { FileText } from 'lucide-react';

const BasicInfoStep = ({ formData, onFormDataChange }) => {
  const updateField = (field, value) => {
    onFormDataChange({ [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-accent-100 dark:bg-accent-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-accent-600 dark:text-accent-400" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Basic Information</h3>
        <p className="text-gray-600 dark:text-slate-300">Tell us about your document type</p>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Document Type Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:border-accent-500 focus:outline-none"
            placeholder="e.g., Purchase Receipt"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            className="w-full border-2 border-gray-300 dark:border-slate-600 p-3 rounded-lg h-24 focus:border-accent-500 focus:outline-none"
            placeholder="Describe what this document type is for..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Destination Webhook (Optional)</label>
          <input
            type="url"
            value={formData.destination_webhook}
            onChange={(e) => updateField('destination_webhook', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:border-accent-500 focus:outline-none"
            placeholder="https://your-api.com/webhook"
          />
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            URL where processed documents will be sent
          </p>
        </div>
      </div>
    </div>
  );
};

export default BasicInfoStep;
