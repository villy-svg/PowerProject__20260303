/**
 * rulesOfflineBypass.js
 *
 * Dev-only localStorage mock & seed helpers for VITE_OFFLINE_BYPASS mode.
 * Extracted from rulesService.js to eliminate ~260 lines of duplicated
 * localStorage CRUD boilerplate and inline seed fixtures.
 */

const BYPASS_KEY_CATEGORIES = 'powerpod_rule_categories_offline';
const BYPASS_KEY_SUB_CATEGORIES = 'powerpod_rule_sub_categories_offline';
const BYPASS_KEY_RULES = 'powerpod_employee_rules_offline';

const SEED_CATEGORIES = [
  { id: 'cat-safety', name: 'Safety & Security', icon: '🛡️', sort_order: 1, description: 'Rules concerning safety protocol, emergency layouts, and gear usage.' },
  { id: 'cat-conduct', name: 'Code of Conduct', icon: '🤝', sort_order: 2, description: 'Professional guidelines, client communication rules, and ethical standards.' },
  { id: 'cat-ops', name: 'Operational Standards', icon: '⚙️', sort_order: 3, description: 'Daily shift workflows, checklists, and facility maintenance rules.' },
];

const SEED_SUB_CATEGORIES = [
  { id: 'sub-ppe', category_id: 'cat-safety', name: 'PPE Requirements', sort_order: 1 },
  { id: 'sub-fire', category_id: 'cat-safety', name: 'Fire Safety Protocols', sort_order: 2 },
  { id: 'sub-attendance', category_id: 'cat-conduct', name: 'Attendance & Punctuality', sort_order: 1 },
  { id: 'sub-harassment', category_id: 'cat-conduct', name: 'Anti-Harassment', sort_order: 2 },
];

const buildSeedRules = () => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  return [
    {
      id: 'rule-ppe-1',
      category_id: 'cat-safety',
      sub_category_id: 'sub-ppe',
      title: 'Mandatory Helmet Usage',
      content: 'All operators must wear safety helmets inside active maintenance bays at all times.',
      drive_url: 'https://drive.google.com',
      effective_date: today,
      is_active: true,
      sort_order: 1,
      impact: 'High',
      created_at: now,
    },
    {
      id: 'rule-fire-1',
      category_id: 'cat-safety',
      sub_category_id: 'sub-fire',
      title: 'Fire Extinguisher Checks',
      content: 'Monthly check of fire extinguisher inspection labels is required for all fire wardens.',
      effective_date: today,
      is_active: true,
      sort_order: 2,
      impact: 'High',
      created_at: now,
    },
    {
      id: 'rule-customer-vehicle',
      category_id: 'cat-conduct',
      sub_category_id: null,
      title: 'No Using Customer Vehicle/Material',
      content: `1. Do not use customer vehicles/materials.
2. ಗ್ರಾಹಕರ ವಾಹನಗಳು/ವಸ್ತುಗಳನ್ನು ಬಳಸಬೇಡಿ
3. Impact: Termination | Fine : Rs. 5,000/- | Pay Full Vehicle Repair Cost
4. ಪ್ರಭಾವ: ಉದ್ಯೋಗ ವಿಲೋಪನೆ | ದಂಡ: ರೂ. 5,000/- | ವಾಹನದ ಸಂಪೂರ್ಣ ದುರಸ್ಥಿ ವೆಚ್ಚವನ್ನು ಪಾವತಿಸಿ`,
      effective_date: today,
      is_active: true,
      sort_order: 3,
      impact: 'Termination | Fine : Rs. 5,000/- | Pay Full Vehicle Repair Cost',
      created_at: now,
    },
    {
      id: 'rule-no-fighting',
      category_id: 'cat-conduct',
      sub_category_id: null,
      title: 'No Fighting or Physical Violence',
      content: `1. Do not engage in physical fights or violence at the workplace.
2. ಕೆಲಸದ ಸ್ಥಳದಲ್ಲಿ ದೈಹಿಕ ಜಗಳಗಳು ಅಥವಾ ಹಿಂಸಾಚಾರದಲ್ಲಿ ತೊಡಗಬೇಡಿ.
3. Impact: Immediate Termination & Legal Action.
4. ಪ್ರಭಾವ: ತಕ್ಷಣದ ಉದ್ಯೋಗ ವಜಾ ಮತ್ತು ಕಾನೂನು ಕ್ರಮ.`,
      effective_date: today,
      is_active: true,
      sort_order: 4,
      impact: 'Immediate Termination & Legal Action',
      created_at: now,
    },
    {
      id: 'rule-no-drinking',
      category_id: 'cat-conduct',
      sub_category_id: null,
      title: 'No Drinking / Alcohol',
      content: `1. No drinking or consumption of alcohol while on duty or on client premises.
2. ಕರ್ತವ್ಯದ ಸಮಯದಲ್ಲಿ ಅಥವಾ ಕ್ಲೈಂಟ್ ಆವರಣದಲ್ಲಿ ಮದ್ಯಪಾನ ಮಾಡುವುದನ್ನು ನಿಷೇಧಿಸಲಾಗಿದೆ.
3. Impact: Immediate Termination | Fine: Rs. 10,000/-
4. ಪ್ರಭಾವ: ತಕ್ಷಣದ ಉದ್ಯೋಗ ವಿಲೋಪನೆ | ದಂಡ: ರೂ. 10,000/-`,
      effective_date: today,
      is_active: true,
      sort_order: 4,
      impact: 'Immediate Termination | Fine: Rs. 10,000/-',
      created_at: now,
    },
    {
      id: 'rule-no-drugs',
      category_id: 'cat-conduct',
      sub_category_id: null,
      title: 'No Customer Vehicle Access Under Influence of Drugs',
      content: `1. Do not access or operate any customer vehicles under the influence of drugs or intoxicating substances.
2. ಮಾದಕ ದ್ರವ್ಯಗಳು ಅಥವಾ ಅಮಲು ಪದಾರ್ಥಗಳ ಪ್ರಭಾವದ ಅಡಿಯಲ್ಲಿ ಯಾವುದೇ ಗ್ರಾಹಕರ ವಾಹನಗಳನ್ನು ಪ್ರವೇಶಿಸಬೇಡಿ ಅಥವಾ ಚಲಾಯಿಸಬೇಡಿ.
3. Impact: Immediate Termination | Criminal Prosecution | Fine: Rs. 20,000/-
4. ಪ್ರಭಾವ: ತಕ್ಷಣದ ಉದ್ಯೋಗ ವಿಲೋಪನೆ | ಕ್ರಿಮಿನಲ್ ಮೊಕದ್ದಮೆ | ದಂಡ: ರೂ. 20,000/-`,
      effective_date: today,
      is_active: true,
      sort_order: 5,
      impact: 'Immediate Termination | Criminal Prosecution | Fine: Rs. 20,000/-',
      created_at: now,
    },
  ];
};

export function isRulesBypassEnabled() {
  return import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true';
}

function getLocal(key, fallback = []) {
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.error(`[rulesOfflineBypass] Error parsing cache for "${key}":`, e);
    }
  }
  return fallback;
}

function saveLocal(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function updateInList(key, id, patch) {
  const items = getLocal(key);
  let updatedItem = null;
  const next = items.map((item) => {
    if (item.id === id) {
      updatedItem = { ...item, ...patch, updated_at: new Date().toISOString() };
      return updatedItem;
    }
    return item;
  });
  saveLocal(key, next);
  return updatedItem;
}

// ─── Categories ────────────────────────────────────────────────
export function bypassFetchCategories() {
  let localCats = getLocal(BYPASS_KEY_CATEGORIES, null);
  if (!localCats) {
    localCats = SEED_CATEGORIES;
    saveLocal(BYPASS_KEY_CATEGORIES, localCats);
  }
  return [...localCats].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
}

export function bypassCreateCategory(data) {
  const cats = getLocal(BYPASS_KEY_CATEGORIES);
  const created = {
    ...data,
    id: `cat-${Date.now()}`,
    sort_order: Number(data.sort_order || 0),
    updated_at: new Date().toISOString(),
  };
  saveLocal(BYPASS_KEY_CATEGORIES, [...cats, created]);
  return created;
}

export function bypassUpdateCategory(id, data) {
  return updateInList(BYPASS_KEY_CATEGORIES, id, data);
}

export function bypassDeleteCategory(id) {
  saveLocal(BYPASS_KEY_CATEGORIES, getLocal(BYPASS_KEY_CATEGORIES).filter((c) => c.id !== id));
  saveLocal(BYPASS_KEY_SUB_CATEGORIES, getLocal(BYPASS_KEY_SUB_CATEGORIES).filter((s) => s.category_id !== id));
  saveLocal(BYPASS_KEY_RULES, getLocal(BYPASS_KEY_RULES).filter((r) => r.category_id !== id));
}

// ─── Sub-Categories ────────────────────────────────────────────
export function bypassFetchSubCategories(categoryId = null) {
  let localSubs = getLocal(BYPASS_KEY_SUB_CATEGORIES, null);
  if (!localSubs) {
    localSubs = SEED_SUB_CATEGORIES;
    saveLocal(BYPASS_KEY_SUB_CATEGORIES, localSubs);
  }
  const filtered = categoryId ? localSubs.filter((s) => s.category_id === categoryId) : localSubs;
  return [...filtered].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
}

export function bypassCreateSubCategory(data) {
  const subs = getLocal(BYPASS_KEY_SUB_CATEGORIES);
  const created = {
    ...data,
    id: `sub-${Date.now()}`,
    sort_order: Number(data.sort_order || 0),
    updated_at: new Date().toISOString(),
  };
  saveLocal(BYPASS_KEY_SUB_CATEGORIES, [...subs, created]);
  return created;
}

export function bypassUpdateSubCategory(id, data) {
  return updateInList(BYPASS_KEY_SUB_CATEGORIES, id, data);
}

export function bypassDeleteSubCategory(id) {
  saveLocal(BYPASS_KEY_SUB_CATEGORIES, getLocal(BYPASS_KEY_SUB_CATEGORIES).filter((s) => s.id !== id));
  saveLocal(
    BYPASS_KEY_RULES,
    getLocal(BYPASS_KEY_RULES).map((r) => (r.sub_category_id === id ? { ...r, sub_category_id: null } : r))
  );
}

// ─── Rules ─────────────────────────────────────────────────────
export function bypassFetchRules({ categoryId = null, activeOnly = true } = {}) {
  let localRules = getLocal(BYPASS_KEY_RULES, null);
  if (!localRules) {
    localRules = buildSeedRules();
    saveLocal(BYPASS_KEY_RULES, localRules);
  }

  const cats = getLocal(BYPASS_KEY_CATEGORIES, []);
  const subs = getLocal(BYPASS_KEY_SUB_CATEGORIES, []);

  let filtered = localRules;
  if (activeOnly) filtered = filtered.filter((r) => r.is_active);
  if (categoryId) filtered = filtered.filter((r) => r.category_id === categoryId);

  const joined = filtered.map((rule) => {
    const catObj = cats.find((c) => c.id === rule.category_id);
    const subObj = subs.find((s) => s.id === rule.sub_category_id);
    return {
      ...rule,
      category: catObj ? { id: catObj.id, name: catObj.name, icon: catObj.icon } : null,
      sub_category: subObj ? { id: subObj.id, name: subObj.name } : null,
    };
  });

  // Safe string fallback avoids undefined comparator when created_at is absent
  return joined.sort(
    (a, b) => (a.sort_order - b.sort_order) || (a.created_at || '').localeCompare(b.created_at || '')
  );
}

export function bypassCreateRule(data) {
  const rules = getLocal(BYPASS_KEY_RULES);
  const now = new Date().toISOString();
  const created = {
    ...data,
    id: `rule-${Date.now()}`,
    sort_order: Number(data.sort_order || 0),
    is_active: data.is_active !== false,
    updated_at: now,
    created_at: now,
  };
  saveLocal(BYPASS_KEY_RULES, [...rules, created]);
  return created;
}

export function bypassUpdateRule(id, data) {
  return updateInList(BYPASS_KEY_RULES, id, data);
}

export function bypassDeleteRule(id) {
  saveLocal(BYPASS_KEY_RULES, getLocal(BYPASS_KEY_RULES).filter((r) => r.id !== id));
}

export function bypassToggleRuleActive(id, isActive) {
  updateInList(BYPASS_KEY_RULES, id, { is_active: isActive });
}
