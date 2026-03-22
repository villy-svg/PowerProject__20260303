import { useState, useCallback } from 'react';
import { clientService } from '../services/clients/clientService';
import { masterErrorHandler } from '../services/core/masterErrorHandler';

/**
 * useClients Hook
 * Manages client state and delegates all DB operations to clientService.
 */
export const useClients = () => {
  const [clients, setClients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [billingModels, setBillingModels] = useState([]);
  const [loading, setLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // READ
  // ---------------------------------------------------------------------------

  const fetchClients = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const result = await clientService.getClients();
      setClients(result.clients);
      setCategories(result.categories);
      setServices(result.services);
      setBillingModels(result.billingModels);
    } catch (error) {
      masterErrorHandler.handleDatabaseError(error, 'useClients.fetchClients');
      // Graceful fallback: raw client data without joins
      try {
        const { supabase } = await import('../services/core/supabaseClient');
        const { data } = await supabase.from('clients').select('*').order('name');
        setClients(data || []);
      } catch (_) { /* swallow fallback error */ }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  const addClient = async (formData) => {
    try {
      const newClient = await clientService.addClient(formData);
      await fetchClients(false);
      return newClient;
    } catch (error) {
      masterErrorHandler.handleDatabaseError(error, 'useClients.addClient');
      throw error;
    }
  };

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  const updateClient = async (id, formData) => {
    try {
      const updated = await clientService.updateClient(id, formData);
      await fetchClients(false);
      return updated;
    } catch (error) {
      masterErrorHandler.handleDatabaseError(error, 'useClients.updateClient');
      throw error;
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    // Optimistic UI update
    const optimisticStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setClients(prev => prev.map(c => c.id === id ? { ...c, status: optimisticStatus } : c));

    try {
      await clientService.toggleStatus(id, currentStatus);
    } catch (error) {
      masterErrorHandler.handleDatabaseError(error, 'useClients.toggleStatus');
      await fetchClients(false); // Revert on failure
      throw error;
    }
  };

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  const deleteClient = async (id) => {
    try {
      await clientService.deleteClient(id);
      setClients(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      masterErrorHandler.handleDatabaseError(error, 'useClients.deleteClient');
      throw error;
    }
  };

  // ---------------------------------------------------------------------------

  return {
    clients,
    categories,
    services,
    billingModels,
    loading,
    fetchClients,
    addClient,
    updateClient,
    toggleStatus,
    deleteClient,
  };
};
