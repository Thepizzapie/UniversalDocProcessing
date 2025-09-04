import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Save } from 'lucide-react';
import { WIZARD_STEPS } from '../constants';
import BasicInfoStep from './BasicInfoStep';
import PipelineStep from './PipelineStep';
import SchemaStep from './SchemaStep';
import ReviewStep from './ReviewStep';

const CreateDocTypeWizard = ({ 
  formData, 
  onFormDataChange, 
  onSave, 
  onCancel, 
  loading,
  editingId = null 
}) => {
  const [wizardStep, setWizardStep] = useState(WIZARD_STEPS.BASIC_INFO);

  // Check if we can proceed to the next step
  const canProceedToStep = (step) => {
    switch (step) {
      case WIZARD_STEPS.PIPELINE_CONFIG:
        return formData.name.trim() && formData.description.trim();
      case WIZARD_STEPS.SCHEMA_INSTRUCTIONS:
        return (
          !!formData.pipeline_config &&
          Array.isArray(formData.pipeline_config.steps) &&
          formData.pipeline_config.steps.length > 0
        );
      case WIZARD_STEPS.REVIEW:
        // Allow proceeding even with empty schemas for now (you can always add fields later)
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (wizardStep < 4) {
      setWizardStep(wizardStep + 1);
    }
  };

  const handlePrevious = () => {
    if (wizardStep > 1) {
      setWizardStep(wizardStep - 1);
    }
  };

  const handleSave = async () => {
    const success = await onSave(editingId);
    if (success) {
      // Reset wizard step after successful save
      setTimeout(() => {
        setWizardStep(WIZARD_STEPS.BASIC_INFO);
      }, 1500);
    }
  };

  const renderStepContent = () => {
    switch (wizardStep) {
      case WIZARD_STEPS.BASIC_INFO:
        return (
          <BasicInfoStep
            formData={formData}
            onFormDataChange={onFormDataChange}
          />
        );
      case WIZARD_STEPS.PIPELINE_CONFIG:
        return (
          <PipelineStep
            formData={formData}
            onFormDataChange={onFormDataChange}
          />
        );
  case WIZARD_STEPS.SCHEMA_INSTRUCTIONS:
        return (
          <SchemaStep
            formData={formData}
            onFormDataChange={onFormDataChange}
    packageMode={formData.package_mode || 'single'}
          />
        );
      case WIZARD_STEPS.REVIEW:
        return (
          <ReviewStep
            formData={formData}
            editingId={editingId}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Progress Bar */}
      <div className="bg-slate-50 dark:bg-slate-900 px-8 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Step {wizardStep} of 4
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {editingId ? 'Editing' : 'Creating'}: {formData.name || 'New Document Type'}
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
          <div 
            className="bg-slate-700 dark:bg-slate-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(wizardStep / 4) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Step Content */}
      <div className="p-8">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="bg-slate-50 dark:bg-slate-900 px-8 py-6 border-t border-slate-200 dark:border-slate-700 flex justify-between">
        <button
          onClick={() => wizardStep > 1 ? handlePrevious() : onCancel()}
          className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{wizardStep > 1 ? 'Previous' : 'Cancel'}</span>
        </button>

        <div className="flex space-x-3">
          {wizardStep < 4 ? (
            <button
              onClick={handleNext}
              disabled={!canProceedToStep(wizardStep + 1)}
              className="bg-slate-700 dark:bg-slate-600 text-white px-6 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 dark:hover:bg-slate-500 transition-colors"
            >
              <span>Next</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={
                loading ||
                !formData.name ||
                (
                  (!formData.parent_schema || Object.keys(formData.parent_schema || {}).length === 0) &&
                  (!formData.child_schema || Object.keys(formData.child_schema || {}).length === 0) &&
                  (Object.keys(formData.output_schema || {}).length === 0)
                )
              }
              className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-700 hover:to-emerald-700 transition-all"
            >
              <Save className="h-4 w-4" />
              <span>{loading ? 'Saving...' : (editingId ? 'Update Type' : 'Create Type')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateDocTypeWizard;
