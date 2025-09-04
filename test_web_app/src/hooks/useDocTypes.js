import { useState, useCallback, useEffect } from 'react';
import { apiService } from '../services/api';
import { DEFAULT_FORM_DATA } from '../components/DocTypes/constants';

export const useDocTypes = () => {
  // Core state
  const [docTypes, setDocTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [tenantId, setTenantId] = useState(localStorage.getItem('tenantId') || '1');

  // Form data
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);

  // Reset form to default state
  const resetForm = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA);
  }, []);

  // Load document types from API
  const loadDocTypes = useCallback(async () => {
    if (!tenantId) return;

    try {
      apiService.setTenantId(tenantId);
      const res = await apiService.getCustomDocTypes();
      setDocTypes(res.data || []);
    } catch (e) {
      console.error('Error loading doc types:', e);
      setMessage('Error loading document types: ' + (e.response?.data?.detail || e.message));
    }
  }, [tenantId]);

  // Create or update document type
  const saveDocType = useCallback(async (editingId = null) => {
    if (!tenantId) {
      setMessage('Please set tenant ID first');
      return false;
    }

    setLoading(true);
    try {
      apiService.setTenantId(tenantId);

      // Determine package mode and compose correct output_schema without clobbering single-package
      const packageMode = formData.package_mode || 'single';

      const hasParent = formData.parent_schema && Object.keys(formData.parent_schema || {}).length > 0;
      const hasChild = formData.child_schema && Object.keys(formData.child_schema || {}).length > 0;
      const isDual = packageMode === 'two' || hasParent || hasChild;

      const unifiedOutputSchema = isDual
        ? {
            parent_schema: formData.parent_schema || {},
            child_schema: formData.child_schema || {},
            collection_key: (formData.output_schema && typeof formData.output_schema.collection_key === 'string' && formData.output_schema.collection_key.trim())
              ? formData.output_schema.collection_key.trim()
              : 'child_entries',
          }
        : (formData.output_schema || {});

      // Build pipeline_config.objects consistently for single vs dual package
      const basePipeline = formData.pipeline_config || {};
      let objects = basePipeline.objects || [];
      if (isDual) {
        objects = [
          {
            name: 'parent',
            object_type: 'parent',
            parent_object_name: null,
            object_schema: unifiedOutputSchema.parent_schema || {},
            extraction_instructions: formData.instructions?.prompt || '',
            hil_config: formData.hil_instructions || {},
            send_config: {},
          },
          {
            name: (unifiedOutputSchema.collection_key || 'child_entries'),
            object_type: 'children',
            parent_object_name: 'parent',
            object_schema: unifiedOutputSchema.child_schema || {},
            extraction_instructions: formData.instructions?.prompt || '',
            hil_config: formData.hil_instructions || {},
            send_config: {},
          },
        ];
      } else {
        objects = [
          {
            name: 'main_object',
            object_type: 'standalone',
            parent_object_name: null,
            object_schema: unifiedOutputSchema,
            extraction_instructions: formData.instructions?.prompt || '',
            hil_config: formData.hil_instructions || {},
            send_config: {},
          },
        ];
      }

      const pipeline_config = {
        name: basePipeline.name || (isDual ? 'Dual Package Review and Send' : 'Extract & Send'),
        description: basePipeline.description || basePipeline.name || '',
        steps: Array.isArray(basePipeline.steps) ? basePipeline.steps : [],
        objects,
        parallel_processing: !!basePipeline.parallel_processing,
        global_config: basePipeline.global_config || {},
      };

      // Send only the fields allowed by the backend schema
      const saveData = {
        name: formData.name,
        description: formData.description,
        instructions: formData.instructions || {},
        output_schema: unifiedOutputSchema,
        destination_webhook: formData.destination_webhook || undefined,
        pipeline_config,
      };

      console.log('Saving doc type with data:', saveData);

      if (editingId) {
        await apiService.updateCustomDocType(editingId, saveData);
        setMessage('Updated successfully');
      } else {
        await apiService.createCustomDocType(saveData);
        setMessage('Created successfully');
      }

      await loadDocTypes();
      return true;
    } catch (e) {
      console.error('Save error:', e);
      setMessage('Error: ' + (e.response?.data?.detail || e.message));
      return false;
    } finally {
      setLoading(false);
    }
  }, [tenantId, formData, loadDocTypes]);

  // Delete document type
  const deleteDocType = useCallback(async (id) => {
    if (!window.confirm('Delete this document type?')) return;

    try {
      apiService.setTenantId(tenantId);
      await apiService.deleteCustomDocType(id);
      setMessage('Deleted successfully');
      await loadDocTypes();
    } catch (e) {
      setMessage('Delete error: ' + (e.response?.data?.detail || e.message));
    }
  }, [tenantId, loadDocTypes]);

  // Update form data
  const updateFormData = useCallback((updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Clear messages
  const clearMessage = useCallback(() => {
    setMessage('');
  }, []);

  // Initialize data on mount
  useEffect(() => {
    loadDocTypes();
  }, [loadDocTypes]);

  return {
    // State
    docTypes,
    loading,
    message,
    tenantId,
    formData,

    // Actions
    setTenantId,
    resetForm,
    loadDocTypes,
    saveDocType,
    deleteDocType,
    updateFormData,
    clearMessage
  };
};
