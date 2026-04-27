import { useState, useCallback, useMemo } from 'react';

/**
 * useTaskForm Hook
 * Headless state manager for task creation and editing.
 * Centralizes dirty checking, multi-step orchestration state, and form data.
 */
export const useTaskForm = (initialData = {}) => {
  const safeInitial = useMemo(() => {
    const data = initialData || {};
    return {
      text: data.text || '',
      priority: data.priority || 'Medium',
      description: data.description || '',
      assigned_to: Array.isArray(data.assigned_to) ? data.assigned_to : (data.assigned_to ? [data.assigned_to] : []),
      parentTask: data.parentTask || '',
      city: data.city || '',
      hub_ids: Array.isArray(data.hub_ids) ? data.hub_ids : (data.hub_id ? [data.hub_id] : []),
      function: data.function || '',
      assigned_client_id: data.assigned_client_id || '',
      // Allow for arbitrary metadata expansion
      ...(data.metadata || {})
    };
  }, [initialData]);

  const [formData, setFormData] = useState(safeInitial);
  const [step, setStep] = useState(1);
  const [orchestrationMapping, setOrchestrationMapping] = useState([]);

  // 1. Change Detection Logic
  // We compare the stringified versions to handle arrays and objects reliably
  const isDirty = useMemo(() => {
    if (!initialData?.id) return true; // New tasks are always "dirty" (ready to save)
    
    // We check only the core fields that exist in the current form
    const currentValues = JSON.stringify(formData);
    const initialValues = JSON.stringify(safeInitial);
    
    return currentValues !== initialValues || orchestrationMapping.length > 0;
  }, [formData, safeInitial, initialData?.id, orchestrationMapping]);

  // 2. Field Update Helpers
  const updateField = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const updateFields = useCallback((updates) => {
    setFormData(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  // 3. Workflow Control
  const nextStep = useCallback(() => setStep(prev => prev + 1), []);
  const prevStep = useCallback(() => setStep(prev => prev - 1), []);
  const resetStep = useCallback(() => setStep(1), []);

  return {
    formData,
    setFormData,
    updateField,
    updateFields,
    isDirty,
    step,
    setStep,
    nextStep,
    prevStep,
    resetStep,
    orchestrationMapping,
    setOrchestrationMapping
  };
};
