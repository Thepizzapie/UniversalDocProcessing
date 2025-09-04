import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { PIPELINE_TEMPLATES, PACKAGE_MODES } from '../constants';

const PipelineStep = ({ formData, onFormDataChange }) => {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [packageMode, setPackageMode] = useState(PACKAGE_MODES.SINGLE); // Default to single; dual only for dual template

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template.name);
    // Enforce package mode by template
    const nextMode = template.key === 'parent_child_review_send' ? PACKAGE_MODES.TWO : PACKAGE_MODES.SINGLE;
    setPackageMode(nextMode);
    
    onFormDataChange({
      pipeline_config: {
        ...formData.pipeline_config,
        name: template.name,
        description: template.description,
        steps: template.steps,
        objects: [{
          name: 'main_object',
          object_type: 'standalone',
          parent_object_name: null,
          object_schema: formData.output_schema,
          extraction_instructions: formData.instructions?.prompt || '',
          hil_config: formData.hil_instructions,
          send_config: {}
        }],
        parallel_processing: false
      },
      package_mode: nextMode
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ArrowRight className="h-8 w-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Pipeline Configuration</h3>
        <p className="text-gray-600 dark:text-slate-300">Choose how your document will be processed</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Choose a Pipeline Template
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PIPELINE_TEMPLATES.map((template, index) => {
              const isDisabled = template.disabled || template.comingSoon;
              const isSelected = selectedTemplate === template.name;
              return (
                <div
                  key={index}
                  onClick={() => {
                    if (isDisabled) return;
                    handleTemplateSelect(template);
                  }}
                  className={`relative p-4 border-2 rounded-lg transition-all ${
                    isDisabled
                      ? 'opacity-60 cursor-not-allowed border-slate-200 dark:border-slate-700'
                      : `cursor-pointer ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">{template.name}</h4>
                    {template.comingSoon && (
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">Coming soon</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{template.description}</p>
                  {template.steps?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {template.steps.map((step, stepIndex) => (
                        <span key={stepIndex} className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                          {step.name || step.step_type}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {selectedTemplate && (
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Output Structure
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className={`p-4 border-2 rounded-lg ${packageMode === PACKAGE_MODES.SINGLE ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-slate-200'}`}>
                <h5 className="font-semibold">Single package</h5>
                <p className="text-sm text-slate-600">All extracted fields in one result object</p>
              </div>
              {packageMode === PACKAGE_MODES.TWO && (
                <div className="p-4 border-2 rounded-lg border-green-500 bg-green-50 dark:bg-green-900/20">
                  <h5 className="font-semibold">Two packages</h5>
                  <p className="text-sm text-slate-600">Separate parent and child objects</p>
                </div>
              )}
              
              <div className="p-4 border-2 rounded-lg opacity-50 border-slate-200">
                <h5 className="font-semibold">Custom structure</h5>
                <p className="text-sm text-slate-600">Define your own object relationships (coming soon)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PipelineStep;
