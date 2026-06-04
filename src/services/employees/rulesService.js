/**
 * rulesService.js
 *
 * Service layer for Employee Rules & Regulations.
 * Abstracts all Supabase queries away from UI components.
 *
 * Tables:
 *   rule_categories       — Top-level groupings (e.g. "Safety", "HR Policy")
 *   rule_sub_categories   — Groupings within a category
 *   employee_rules        — Individual rule entries
 */

import { supabase } from '../core/supabaseClient';

// ─── CATEGORIES ────────────────────────────────────────────────────────────────

/**
 * Fetch all rule categories ordered by sort_order, then name.
 */
export async function fetchCategories() {
  const { data, error } = await supabase
    .from('rule_categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Create a new rule category.
 * @param {{ name: string, icon?: string, description?: string, sort_order?: number }} data
 */
export async function createCategory(data) {
  const { data: created, error } = await supabase
    .from('rule_categories')
    .insert([{ ...data, updated_at: new Date().toISOString() }])
    .select()
    .single();

  if (error) throw error;
  return created;
}

/**
 * Update an existing rule category.
 * @param {string} id
 * @param {object} data
 */
export async function updateCategory(id, data) {
  const { data: updated, error } = await supabase
    .from('rule_categories')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

/**
 * Delete a rule category (cascades to sub-categories and rules).
 * @param {string} id
 */
export async function deleteCategory(id) {
  const { error } = await supabase
    .from('rule_categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ─── SUB-CATEGORIES ────────────────────────────────────────────────────────────

/**
 * Fetch sub-categories, optionally filtered by category_id.
 * @param {string|null} categoryId
 */
export async function fetchSubCategories(categoryId = null) {
  let query = supabase
    .from('rule_sub_categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Create a new sub-category.
 * @param {{ category_id: string, name: string, sort_order?: number }} data
 */
export async function createSubCategory(data) {
  const { data: created, error } = await supabase
    .from('rule_sub_categories')
    .insert([{ ...data, updated_at: new Date().toISOString() }])
    .select()
    .single();

  if (error) throw error;
  return created;
}

/**
 * Update an existing sub-category.
 * @param {string} id
 * @param {object} data
 */
export async function updateSubCategory(id, data) {
  const { data: updated, error } = await supabase
    .from('rule_sub_categories')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

/**
 * Delete a sub-category (rules will have sub_category_id set to NULL).
 * @param {string} id
 */
export async function deleteSubCategory(id) {
  const { error } = await supabase
    .from('rule_sub_categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ─── RULES ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all employee rules with joined category and sub-category names.
 * @param {{ categoryId?: string, activeOnly?: boolean }} options
 */
export async function fetchRules({ categoryId = null, activeOnly = true } = {}) {
  let query = supabase
    .from('employee_rules')
    .select(`
      *,
      category:rule_categories ( id, name, icon ),
      sub_category:rule_sub_categories ( id, name )
    `)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Create a new rule.
 * @param {{
 *   category_id: string,
 *   sub_category_id?: string,
 *   title: string,
 *   content?: string,
 *   drive_url?: string,
 *   effective_date?: string,
 *   is_active?: boolean,
 *   sort_order?: number,
 *   created_by?: string
 * }} data
 */
export async function createRule(data) {
  const { data: created, error } = await supabase
    .from('employee_rules')
    .insert([{ ...data, updated_at: new Date().toISOString() }])
    .select()
    .single();

  if (error) throw error;
  return created;
}

/**
 * Update an existing rule.
 * @param {string} id
 * @param {object} data
 */
export async function updateRule(id, data) {
  const { data: updated, error } = await supabase
    .from('employee_rules')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

/**
 * Delete a rule permanently.
 * @param {string} id
 */
export async function deleteRule(id) {
  const { error } = await supabase
    .from('employee_rules')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Toggle a rule's active status.
 * @param {string} id
 * @param {boolean} isActive
 */
export async function toggleRuleActive(id, isActive) {
  const { error } = await supabase
    .from('employee_rules')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}
