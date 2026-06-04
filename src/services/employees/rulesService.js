/**
 * rulesService.js
 *
 * Service layer for Employee Rules & Regulations.
 * Abstracts all Supabase queries away from UI components.
 * Supports VITE_OFFLINE_BYPASS local caching.
 *
 * Tables:
 *   rule_categories       — Top-level groupings (e.g. "Safety", "HR Policy")
 *   rule_sub_categories   — Groupings within a category
 *   employee_rules        — Individual rule entries
 */

import { supabase } from '../core/supabaseClient';

const BYPASS_KEY_CATEGORIES = 'powerpod_rule_categories_offline';
const BYPASS_KEY_SUB_CATEGORIES = 'powerpod_rule_sub_categories_offline';
const BYPASS_KEY_RULES = 'powerpod_employee_rules_offline';

function isBypassEnabled() {
  return import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true';
}

function getLocalData(key, fallback = []) {
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.error(`[rulesService] Error parsing cache for key "${key}":`, e);
    }
  }
  return fallback;
}

function saveLocalData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── CATEGORIES ────────────────────────────────────────────────────────────────

/**
 * Fetch all rule categories ordered by sort_order, then name.
 */
export async function fetchCategories() {
  if (isBypassEnabled()) {
    let localCats = getLocalData(BYPASS_KEY_CATEGORIES, null);
    if (!localCats) {
      localCats = [
        { id: 'cat-safety', name: 'Safety & Security', icon: '🛡️', sort_order: 1, description: 'Rules concerning safety protocol, emergency layouts, and gear usage.' },
        { id: 'cat-conduct', name: 'Code of Conduct', icon: '🤝', sort_order: 2, description: 'Professional guidelines, client communication rules, and ethical standards.' },
        { id: 'cat-ops', name: 'Operational Standards', icon: '⚙️', sort_order: 3, description: 'Daily shift workflows, checklists, and facility maintenance rules.' }
      ];
      saveLocalData(BYPASS_KEY_CATEGORIES, localCats);
    }
    return localCats.sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
  }

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
  if (isBypassEnabled()) {
    const cats = getLocalData(BYPASS_KEY_CATEGORIES);
    const newCat = { ...data, id: `cat-${Date.now()}`, sort_order: Number(data.sort_order || 0), updated_at: new Date().toISOString() };
    saveLocalData(BYPASS_KEY_CATEGORIES, [...cats, newCat]);
    return newCat;
  }

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
  if (isBypassEnabled()) {
    const cats = getLocalData(BYPASS_KEY_CATEGORIES);
    let updatedItem = null;
    const nextCats = cats.map(cat => {
      if (cat.id === id) {
        updatedItem = { ...cat, ...data, updated_at: new Date().toISOString() };
        return updatedItem;
      }
      return cat;
    });
    saveLocalData(BYPASS_KEY_CATEGORIES, nextCats);
    return updatedItem;
  }

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
  if (isBypassEnabled()) {
    const cats = getLocalData(BYPASS_KEY_CATEGORIES);
    saveLocalData(BYPASS_KEY_CATEGORIES, cats.filter(cat => cat.id !== id));
    
    // Cascade to subcategories
    const subs = getLocalData(BYPASS_KEY_SUB_CATEGORIES);
    saveLocalData(BYPASS_KEY_SUB_CATEGORIES, subs.filter(sub => sub.category_id !== id));

    // Cascade to rules
    const rules = getLocalData(BYPASS_KEY_RULES);
    saveLocalData(BYPASS_KEY_RULES, rules.filter(r => r.category_id !== id));
    return;
  }

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
  if (isBypassEnabled()) {
    let localSubs = getLocalData(BYPASS_KEY_SUB_CATEGORIES, null);
    if (!localSubs) {
      localSubs = [
        { id: 'sub-ppe', category_id: 'cat-safety', name: 'PPE Requirements', sort_order: 1 },
        { id: 'sub-fire', category_id: 'cat-safety', name: 'Fire Safety Protocols', sort_order: 2 },
        { id: 'sub-attendance', category_id: 'cat-conduct', name: 'Attendance & Punctuality', sort_order: 1 },
        { id: 'sub-harassment', category_id: 'cat-conduct', name: 'Anti-Harassment', sort_order: 2 }
      ];
      saveLocalData(BYPASS_KEY_SUB_CATEGORIES, localSubs);
    }
    const filtered = categoryId ? localSubs.filter(s => s.category_id === categoryId) : localSubs;
    return filtered.sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
  }

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
  if (isBypassEnabled()) {
    const subs = getLocalData(BYPASS_KEY_SUB_CATEGORIES);
    const newSub = { ...data, id: `sub-${Date.now()}`, sort_order: Number(data.sort_order || 0), updated_at: new Date().toISOString() };
    saveLocalData(BYPASS_KEY_SUB_CATEGORIES, [...subs, newSub]);
    return newSub;
  }

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
  if (isBypassEnabled()) {
    const subs = getLocalData(BYPASS_KEY_SUB_CATEGORIES);
    let updatedItem = null;
    const nextSubs = subs.map(sub => {
      if (sub.id === id) {
        updatedItem = { ...sub, ...data, updated_at: new Date().toISOString() };
        return updatedItem;
      }
      return sub;
    });
    saveLocalData(BYPASS_KEY_SUB_CATEGORIES, nextSubs);
    return updatedItem;
  }

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
  if (isBypassEnabled()) {
    const subs = getLocalData(BYPASS_KEY_SUB_CATEGORIES);
    saveLocalData(BYPASS_KEY_SUB_CATEGORIES, subs.filter(sub => sub.id !== id));

    // Nullify sub_category_id links in rules
    const rules = getLocalData(BYPASS_KEY_RULES);
    saveLocalData(BYPASS_KEY_RULES, rules.map(r => r.sub_category_id === id ? { ...r, sub_category_id: null } : r));
    return;
  }

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
  if (isBypassEnabled()) {
    let localRules = getLocalData(BYPASS_KEY_RULES, null);
    if (!localRules) {
      localRules = [
        {
          id: 'rule-ppe-1',
          category_id: 'cat-safety',
          sub_category_id: 'sub-ppe',
          title: 'Mandatory Helmet Usage',
          content: 'All operators must wear safety helmets inside active maintenance bays at all times.',
          drive_url: 'https://drive.google.com',
          effective_date: new Date().toISOString().split('T')[0],
          is_active: true,
          sort_order: 1,
          impact: 'High'
        },
        {
          id: 'rule-fire-1',
          category_id: 'cat-safety',
          sub_category_id: 'sub-fire',
          title: 'Fire Extinguisher Checks',
          content: 'Monthly check of fire extinguisher inspection labels is required for all fire wardens.',
          effective_date: new Date().toISOString().split('T')[0],
          is_active: true,
          sort_order: 2,
          impact: 'High'
        }
      ];
      saveLocalData(BYPASS_KEY_RULES, localRules);
    }

    const cats = getLocalData(BYPASS_KEY_CATEGORIES, []);
    const subs = getLocalData(BYPASS_KEY_SUB_CATEGORIES, []);

    // Filter rules
    let filtered = localRules;
    if (activeOnly) {
      filtered = filtered.filter(r => r.is_active);
    }
    if (categoryId) {
      filtered = filtered.filter(r => r.category_id === categoryId);
    }

    // Join operations simulated locally
    const joined = filtered.map(rule => {
      const catObj = cats.find(c => c.id === rule.category_id);
      const subObj = subs.find(s => s.id === rule.sub_category_id);
      return {
        ...rule,
        category: catObj ? { id: catObj.id, name: catObj.name, icon: catObj.icon } : null,
        sub_category: subObj ? { id: subObj.id, name: subObj.name } : null
      };
    });

    return joined.sort((a, b) => (a.sort_order - b.sort_order) || a.created_at?.localeCompare(b.created_at || ''));
  }

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
  if (isBypassEnabled()) {
    const rules = getLocalData(BYPASS_KEY_RULES);
    const newRule = { ...data, id: `rule-${Date.now()}`, sort_order: Number(data.sort_order || 0), is_active: data.is_active !== false, updated_at: new Date().toISOString(), created_at: new Date().toISOString() };
    saveLocalData(BYPASS_KEY_RULES, [...rules, newRule]);
    return newRule;
  }

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
  if (isBypassEnabled()) {
    const rules = getLocalData(BYPASS_KEY_RULES);
    let updatedItem = null;
    const nextRules = rules.map(rule => {
      if (rule.id === id) {
        updatedItem = { ...rule, ...data, updated_at: new Date().toISOString() };
        return updatedItem;
      }
      return rule;
    });
    saveLocalData(BYPASS_KEY_RULES, nextRules);
    return updatedItem;
  }

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
  if (isBypassEnabled()) {
    const rules = getLocalData(BYPASS_KEY_RULES);
    saveLocalData(BYPASS_KEY_RULES, rules.filter(rule => rule.id !== id));
    return;
  }

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
  if (isBypassEnabled()) {
    const rules = getLocalData(BYPASS_KEY_RULES);
    saveLocalData(BYPASS_KEY_RULES, rules.map(rule => rule.id === id ? { ...rule, is_active: isActive, updated_at: new Date().toISOString() } : rule));
    return;
  }

  const { error } = await supabase
    .from('employee_rules')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}
