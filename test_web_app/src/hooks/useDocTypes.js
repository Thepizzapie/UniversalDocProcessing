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

      // Prepare the data for saving
      const saveData = { ...formData };
      
      // For dual package mode, ensure output_schema is properly structured
      if (formData.parent_schema || formData.child_schema) {
        saveData.output_schema = {
          parent_schema: formData.parent_schema || {},
          child_schema: formData.child_schema || {},
          collection_key: 'child_entries'
        };
      }
      
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
