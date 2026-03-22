/**
 * Client Service
 * Stateless service for all Supabase operations related to clients and their
 * linked lookup tables (categories, services, billing models).
 * Canonical location: src/services/clients/clientService.js
 *
 * Consuming hook: src/hooks/useClients.js
 */
import { supabase } from '../core/supabaseClient';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const clientService = {
  /**
   * Fetch all clients and their linked lookup tables in parallel.
   * Returns resolved client list and raw lookup data for forms.
   * @returns {{ clients, categories, services, billingModels }}
   */
  async getClients() {
    const [
      { data: clientsData, error: clientErr },
      { data: catsData },
      { data: servicesData },
      { data: modelsData },
    ] = await Promise.all([
      supabase.from('clients').select('*').order('name', { ascending: true }),
      supabase.from('client_categories').select('*').order('name'),
      supabase.from('client_services').select('*').order('name'),
      supabase.from('client_billing_models').select('id, name, code').order('name'),
    ]);

    if (clientErr) throw clientErr;

    const modelMap = new Map((modelsData || []).map(m => [m.id, { name: m.name, code: m.code }]));

    // Pre-process lookup dictionaries for quick access in display components
    const vehicleCats = {};
    const serviceCats = {};
    (catsData || []).forEach(c => { vehicleCats[c.id] = c; });
    (servicesData || []).forEach(s => { serviceCats[s.id] = s; });

    const clients = (clientsData || []).map(client => ({
      ...client,
      billing_model_name: modelMap.get(client.billing_model_id)?.name || 'N/A',
      billing_model_code: modelMap.get(client.billing_model_id)?.code || 'N/A',
      vehicle_categories: vehicleCats,
      service_categories: serviceCats,
    }));

    return {
      clients,
      categories: catsData || [],
      services: servicesData || [],
      billingModels: modelsData || [],
    };
  },

  /**
   * Insert a new client.
   * @param {Object} formData
   * @returns {Object} The newly created client row.
   */
  async addClient(formData) {
    const row = {
      name: formData.name,
      billing_model_id: formData.billing_model_id || null,
      poc_name: formData.poc_name || null,
      poc_phone: formData.poc_phone || null,
      poc_email: formData.poc_email || null,
      category_matrix: formData.category_matrix || {},
      status: 'Active',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('clients').insert([row]).select();
    if (error) throw error;
    return data?.[0];
  },

  /**
   * Full update of a client record.
   * @param {string} id
   * @param {Object} formData
   * @returns {Object} The updated client row.
   */
  async updateClient(id, formData) {
    const row = {
      name: formData.name,
      billing_model_id: formData.billing_model_id || null,
      poc_name: formData.poc_name || null,
      poc_phone: formData.poc_phone || null,
      poc_email: formData.poc_email || null,
      category_matrix: formData.category_matrix || {},
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('clients').update(row).eq('id', id).select();
    if (error) throw error;
    return data?.[0];
  },

  /**
   * Toggle a client's active/inactive status.
   * @param {string} id
   * @param {'Active'|'Inactive'} currentStatus
   * @returns {'Active'|'Inactive'} The new status.
   */
  async toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    const { error } = await supabase
      .from('clients')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return newStatus;
  },

  /**
   * Permanently delete a client.
   * @param {string} id
   */
  async deleteClient(id) {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
  },
};
