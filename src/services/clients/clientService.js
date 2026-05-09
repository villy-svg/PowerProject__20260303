/**
 * clientService.js
 * Stateless service for all Supabase CRUD operations on the 'clients' table
 * and related reference tables (client_categories, client_billing_models, client_services).
 *
 * Consuming components:
 *   - src/verticals/Clients/ClientManagement.jsx
 *   - src/verticals/Clients/ClientCategoryManagement.jsx
 *   - src/verticals/Clients/ClientBillingModelManagement.jsx
 *   - src/verticals/Clients/ClientServiceManagement.jsx
 *
 * Pattern mirrors: src/services/employees/employeeService.js
 * Canonical location: src/services/clients/clientService.js
 */
import { supabase } from '../core/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// SELECT strings (PostgREST)
// ─────────────────────────────────────────────────────────────────────────────

const CLIENT_SELECT = `
  *,
  client_categories(id, name),
  client_billing_models(id, name, code),
  client_services(id, name)
`;

// ─────────────────────────────────────────────────────────────────────────────
// Normalizer (Minimal change to keep existing UI working)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * normalizeClient(row)
 * Ensures consistency but keeps original snake_case for compatibility.
 */
const normalizeClient = (row) => ({
  ...row,
  billing_model_name: row.client_billing_models?.name || 'N/A',
  billing_model_code: row.client_billing_models?.code || 'N/A',
  category_name: row.client_categories?.name || 'N/A',
});

// ─────────────────────────────────────────────────────────────────────────────
// Client CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const clientService = {
  /**
   * getClients() — Fetch all clients with joined relations.
   */
  async getClients() {
    const { data, error } = await supabase
      .from('clients')
      .select(CLIENT_SELECT)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(normalizeClient);
  },

  /**
   * getClientById(id)
   */
  async getClientById(id) {
    const { data, error } = await supabase
      .from('clients')
      .select(CLIENT_SELECT)
      .eq('id', id)
      .single();

    if (error) throw error;
    return normalizeClient(data);
  },

  /**
   * addClient(formData)
   */
  async addClient(formData) {
    const { data, error } = await supabase
      .from('clients')
      .insert([{ ...formData, updated_at: new Date().toISOString() }])
      .select(CLIENT_SELECT)
      .single();

    if (error) throw error;
    return normalizeClient(data);
  },

  /**
   * updateClient(id, formData)
   */
  async updateClient(id, formData) {
    const { data, error } = await supabase
      .from('clients')
      .update({ ...formData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(CLIENT_SELECT)
      .single();

    if (error) throw error;
    return normalizeClient(data);
  },

  /**
   * toggleStatus(id, currentStatus)
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
   * deleteClient(id)
   */
  async deleteClient(id) {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * getAllReferenceData() - Fetch all lookup tables in parallel.
   */
  async getAllReferenceData() {
    const [
      { data: catsData },
      { data: servicesData },
      { data: modelsData },
    ] = await Promise.all([
      supabase.from('client_categories').select('*').order('name'),
      supabase.from('client_services').select('*').order('name'),
      supabase.from('client_billing_models').select('*').order('name'),
    ]);

    return {
      categories: catsData || [],
      services: servicesData || [],
      billingModels: modelsData || [],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Client Categories CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const clientCategoryService = {
  async getCategories() {
    const { data, error } = await supabase
      .from('client_categories')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addCategory(categoryData) {
    const { data, error } = await supabase
      .from('client_categories')
      .insert([{ ...categoryData, updated_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateCategory(id, categoryData) {
    const { data, error } = await supabase
      .from('client_categories')
      .update({ ...categoryData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCategory(id) {
    const { error } = await supabase.from('client_categories').delete().eq('id', id);
    if (error) throw error;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Billing Models CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const billingModelService = {
  async getBillingModels() {
    const { data, error } = await supabase
      .from('client_billing_models')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addBillingModel(modelData) {
    const { data, error } = await supabase
      .from('client_billing_models')
      .insert([{ ...modelData, updated_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateBillingModel(id, modelData) {
    const { data, error } = await supabase
      .from('client_billing_models')
      .update({ ...modelData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteBillingModel(id) {
    const { error } = await supabase.from('client_billing_models').delete().eq('id', id);
    if (error) throw error;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Client Services CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const clientServiceManager = {
  async getServices() {
    const { data, error } = await supabase
      .from('client_services')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addService(serviceData) {
    const { data, error } = await supabase
      .from('client_services')
      .insert([{ ...serviceData, updated_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateService(id, serviceData) {
    const { data, error } = await supabase
      .from('client_services')
      .update({ ...serviceData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteService(id) {
    const { error } = await supabase.from('client_services').delete().eq('id', id);
    if (error) throw error;
  },
};
