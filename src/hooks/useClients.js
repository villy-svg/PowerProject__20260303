import { useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

/**
 * useClients Hook
 * Encapsulates all data fetching and mutation logic for client records.
 */
export const useClients = () => {
  const [clients, setClients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [billingModels, setBillingModels] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchClients = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [
        { data: clientsData, error: clientErr },
        { data: catsData },
        { data: servicesData },
        { data: modelsData }
      ] = await Promise.all([
        supabase.from('clients').select('*').order('name', { ascending: true }),
        supabase.from('client_categories').select('*').order('name'),
        supabase.from('client_services').select('*').order('name'),
        supabase.from('client_billing_models').select('id, name, code').order('name'),
      ]);

      if (clientErr) throw clientErr;

      const catMap = new Map((catsData || []).map(c => [c.id, { name: c.name, code: c.code }]));
      const modelMap = new Map((modelsData || []).map(m => [m.id, { name: m.name, code: m.code }]));

      // Pre-process category dictionaries for quick lookup in display components
      const vehicleCats = {};
      const serviceCats = {};
      (catsData || []).forEach(c => {
        vehicleCats[c.id] = c;
      });
      (servicesData || []).forEach(s => {
        serviceCats[s.id] = s;
      });

      const processed = (clientsData || []).map(client => ({
        ...client,
        billing_model_name: modelMap.get(client.billing_model_id)?.name || 'N/A',
        billing_model_code: modelMap.get(client.billing_model_id)?.code || 'N/A',
        vehicle_categories: vehicleCats,
        service_categories: serviceCats,
      }));

      setClients(processed);
      if (catsData) setCategories(catsData);
      if (servicesData) setServices(servicesData); // Still need to add setServices to state
      if (modelsData) setBillingModels(modelsData);
    } catch (error) {
      console.error('useClients: Fetch Error:', error);
      const { data } = await supabase.from('clients').select('*').order('name');
      setClients(data || []);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const addClient = async (formData) => {
    const clientData = {
      name: formData.name,
      billing_model_id: formData.billing_model_id || null,
      poc_name: formData.poc_name || null,
      poc_phone: formData.poc_phone || null,
      poc_email: formData.poc_email || null,
      category_matrix: formData.category_matrix || {},
      status: 'Active',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('clients').insert([clientData]).select();
    if (error) {
      console.error('useClients: Insert Error:', error);
      throw error;
    }

    await fetchClients(false);
    return data?.[0];
  };

  const updateClient = async (id, formData) => {
    const updateData = {
      name: formData.name,
      billing_model_id: formData.billing_model_id || null,
      poc_name: formData.poc_name || null,
      poc_phone: formData.poc_phone || null,
      poc_email: formData.poc_email || null,
      category_matrix: formData.category_matrix || {},
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('useClients: Update Error:', error);
      throw error;
    }

    await fetchClients(false);
    return data?.[0];
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

    // Optimistic UI
    setClients(prev =>
      prev.map(c => c.id === id ? { ...c, status: newStatus } : c)
    );

    const { error } = await supabase
      .from('clients')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('useClients: Toggle Status Error:', error);
      await fetchClients(false);
      throw error;
    }
  };

  const deleteClient = async (id) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
    setClients(prev => prev.filter(c => c.id !== id));
  };

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
