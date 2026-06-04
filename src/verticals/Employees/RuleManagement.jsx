import React, { useState, useEffect, useCallback } from 'react';
import MasterPageHeader from '../../components/MasterPageHeader';
// Note: TaskModal removed — RuleManagement uses native modal-overlay pattern
import {
  fetchCategories,
  fetchSubCategories,
  fetchRules,
  createCategory, updateCategory, deleteCategory,
  createSubCategory, updateSubCategory, deleteSubCategory,
  createRule, updateRule, deleteRule, toggleRuleActive,
} from '../../services/employees/rulesService';
import '../ChargingHubs/HubFunctionManagement.css'; // Shared management styles
import './EmployeeRulesBoard.css'; // Badge styles

/**
 * RuleManagement
 *
 * Master-admin–only configuration page for managing:
 *   1. Rule Categories
 *   2. Rule Sub-categories
 *   3. Individual Rules
 *
 * Accessible from: Configuration → Employee Manager → Rule Management
 */

/* ─── Inline Management CSS ─────────────────────────────────── */
const inlineStyles = `
.rule-mgmt-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0;
}

.rule-mgmt-tab {
  padding: 0.5rem 1.25rem 0.65rem;
  border: none;
  background: none;
  color: var(--text-color);
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  opacity: 0.45;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
  font-family: 'Inter', system-ui, sans-serif;
  position: relative;
  top: 1px;
}

.rule-mgmt-tab:hover { opacity: 0.75; }

.rule-mgmt-tab.active {
  opacity: 1;
  color: var(--brand-green);
  border-bottom-color: var(--brand-green);
}

.rule-mgmt-content {
  padding: clamp(1rem, 3vw, 1.5rem);
}

/* ── Rule Item Row (for rules table) */
.rule-item-row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  margin-bottom: 0.6rem;
  background: rgba(255,255,255,0.02);
  transition: all 0.2s ease;
}

.rule-item-row:hover {
  border-color: color-mix(in srgb, var(--brand-green), transparent 70%);
}

.rule-item-row.inactive-rule {
  opacity: 0.45;
}

.rule-item-info {
  flex: 1;
  min-width: 0;
}

.rule-item-title {
  font-size: 0.88rem;
  font-weight: 700;
  margin: 0 0 0.3rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rule-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.rule-item-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

/* ── Toggle switch */
.rule-toggle {
  width: 32px;
  height: 18px;
  background: var(--border-color);
  border-radius: 999px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s ease;
  border: none;
  padding: 0;
  flex-shrink: 0;
}

.rule-toggle.on { background: var(--brand-green); }

.rule-toggle::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  top: 3px;
  left: 3px;
  transition: transform 0.2s ease;
}

.rule-toggle.on::after { transform: translateX(14px); }

/* ── Form textarea */
.rule-form-textarea {
  width: 100%;
  min-height: 120px;
  padding: 0.75rem;
  background: var(--halo-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-color);
  font-size: 0.9rem;
  font-family: 'Inter', system-ui, sans-serif;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s ease;
}

.rule-form-textarea:focus {
  border-color: var(--brand-green);
}

/* ── Section header */
.rule-mgmt-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.rule-mgmt-section-title {
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.5;
  margin: 0;
}

/* ── Category filter for rules tab */
.rule-cat-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.rule-cat-filter-btn {
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--halo-bg);
  color: var(--text-color);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  cursor: pointer;
  opacity: 0.55;
  transition: all 0.2s ease;
  font-family: 'Inter', system-ui, sans-serif;
}

.rule-cat-filter-btn:hover { opacity: 0.85; }

.rule-cat-filter-btn.active {
  opacity: 1;
  color: var(--brand-green);
  border-color: var(--brand-green);
  background: color-mix(in srgb, var(--brand-green), transparent 90%);
}

@media screen and (max-width: 768px) {
  .rule-mgmt-tabs { gap: 0; }
  .rule-mgmt-tab { padding: 0.5rem 0.75rem; font-size: 0.72rem; }
}
/* ── Status message for form feedback */
.status-message {
  padding: 0.6rem 0.9rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: 'Inter', system-ui, sans-serif;
  border: 1px solid var(--border-color);
  background: rgba(255,255,255,0.03);
}
.status-message.success {
  color: var(--brand-green);
  border-color: color-mix(in srgb, var(--brand-green), transparent 65%);
  background: color-mix(in srgb, var(--brand-green), transparent 92%);
}
.status-message.error {
  color: #ef4444;
  border-color: color-mix(in srgb, #ef4444, transparent 65%);
  background: color-mix(in srgb, #ef4444, transparent 92%);
}

/* ── Empty state for tab panels */
.rule-empty-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  text-align: center;
  opacity: 0.5;
  font-size: 0.88rem;
}
`;

/* ─── Shared status message helper ─────────────────────────── */
const StatusMsg = ({ msg }) => {
  if (!msg?.text) return null;
  return (
    <div className={`status-message ${msg.type}`} style={{ marginTop: '0.75rem' }}>
      {msg.text}
    </div>
  );
};

/* ─── Category Form Modal ───────────────────────────────────── */
const CategoryFormModal = ({ isOpen, onClose, editingItem, onSave }) => {
  const [form, setForm] = useState({ name: '', icon: '', description: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' });

  useEffect(() => {
    if (editingItem) {
      setForm({
        name: editingItem.name || '',
        icon: editingItem.icon || '',
        description: editingItem.description || '',
        sort_order: editingItem.sort_order || 0,
      });
    } else {
      setForm({ name: '', icon: '', description: '', sort_order: 0 });
    }
    setStatus({ type: '', text: '' });
  }, [editingItem, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem) {
        await updateCategory(editingItem.id, form);
      } else {
        await createCategory(form);
      }
      setStatus({ type: 'success', text: `Category ${editingItem ? 'updated' : 'created'} successfully!` });
      setTimeout(() => { onSave(); onClose(); }, 800);
    } catch (err) {
      setStatus({ type: 'error', text: `Error: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content hub-modal" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{editingItem ? 'Edit Category' : 'New Category'}</h2>
          <button className="close-modal" onClick={onClose}>&times;</button>
        </header>
        <form onSubmit={handleSubmit} className="vertical-task-form">
          <div className="modal-content-area">
            <div className="form-row-grid">
              <div className="form-group">
                <label>Category Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Safety, HR Policy, Conduct"
                  required
                />
              </div>
              <div className="form-group">
                <label>Icon (Emoji)</label>
                <input
                  type="text"
                  value={form.icon}
                  onChange={e => setForm(p => ({ ...p, icon: e.target.value }))}
                  placeholder="e.g. 🛡️ 📋 👥"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                className="rule-form-textarea"
                style={{ minHeight: '80px' }}
                rows={3}
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of this category"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                  }
                }}
              />
            </div>
            <div className="form-group">
              <label>Sort Order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
                min={0}
              />
            </div>
            <StatusMsg msg={status} />
          </div>
          <div className="modal-footer">
            <button type="button" className="halo-button cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="halo-button save-btn" disabled={saving}>
              {saving ? 'Saving...' : (editingItem ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Sub-Category Form Modal ───────────────────────────────── */
const SubCategoryFormModal = ({ isOpen, onClose, editingItem, categories, onSave }) => {
  const [form, setForm] = useState({ category_id: '', name: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' });

  useEffect(() => {
    if (editingItem) {
      setForm({
        category_id: editingItem.category_id || '',
        name: editingItem.name || '',
        sort_order: editingItem.sort_order || 0,
      });
    } else {
      setForm({ category_id: categories[0]?.id || '', name: '', sort_order: 0 });
    }
    setStatus({ type: '', text: '' });
  }, [editingItem, isOpen, categories]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category_id) { setStatus({ type: 'error', text: 'Please select a parent category.' }); return; }
    setSaving(true);
    try {
      if (editingItem) {
        await updateSubCategory(editingItem.id, form);
      } else {
        await createSubCategory(form);
      }
      setStatus({ type: 'success', text: `Sub-category ${editingItem ? 'updated' : 'created'}!` });
      setTimeout(() => { onSave(); onClose(); }, 800);
    } catch (err) {
      setStatus({ type: 'error', text: `Error: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content hub-modal" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{editingItem ? 'Edit Sub-Category' : 'New Sub-Category'}</h2>
          <button className="close-modal" onClick={onClose}>&times;</button>
        </header>
        <form onSubmit={handleSubmit} className="vertical-task-form">
          <div className="modal-content-area">
            <div className="form-group">
              <label>Parent Category</label>
              <select
                className="master-dropdown"
                value={form.category_id}
                onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
                required
              >
                <option value="">— Select Category —</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon ? `${cat.icon} ` : ''}{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="form-row-grid">
              <div className="form-group">
                <label>Sub-Category Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Emergency Procedures"
                  required
                />
              </div>
              <div className="form-group">
                <label>Sort Order</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
                  min={0}
                />
              </div>
            </div>
            <StatusMsg msg={status} />
          </div>
          <div className="modal-footer">
            <button type="button" className="halo-button cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="halo-button save-btn" disabled={saving}>
              {saving ? 'Saving...' : (editingItem ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Rule Form Modal ───────────────────────────────────────── */
const RuleFormModal = ({ isOpen, onClose, editingItem, categories, subCategories, userId, onSave }) => {
  const [form, setForm] = useState({
    category_id: '', sub_category_id: '', title: '', content: '',
    drive_url: '', effective_date: '', is_active: true, sort_order: 0,
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' });
  const [hasDraft, setHasDraft] = useState(false);

  const filteredSubs = form.category_id
    ? subCategories.filter(s => s.category_id === form.category_id)
    : [];

  useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        setForm({
          category_id: editingItem.category_id || '',
          sub_category_id: editingItem.sub_category_id || '',
          title: editingItem.title || '',
          content: editingItem.content || '',
          drive_url: editingItem.drive_url || '',
          effective_date: editingItem.effective_date || '',
          is_active: editingItem.is_active !== false,
          sort_order: editingItem.sort_order || 0,
        });
        setHasDraft(false);
      } else {
        const savedDraft = localStorage.getItem('rule_form_draft');
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            setForm(parsed);
            setHasDraft(true);
          } catch (e) {
            console.error('Error parsing draft:', e);
          }
        } else {
          setForm({
            category_id: categories[0]?.id || '',
            sub_category_id: '', title: '', content: '',
            drive_url: '', effective_date: '', is_active: true, sort_order: 0,
          });
          setHasDraft(false);
        }
      }
      setStatus({ type: '', text: '' });
    }
  }, [editingItem, isOpen, categories]);

  // Save draft to localStorage on change if not editing
  useEffect(() => {
    if (!editingItem && isOpen && (form.title || form.content || form.drive_url)) {
      localStorage.setItem('rule_form_draft', JSON.stringify(form));
    }
  }, [form, editingItem, isOpen]);

  const handleDiscardDraft = () => {
    localStorage.removeItem('rule_form_draft');
    setForm({
      category_id: categories[0]?.id || '',
      sub_category_id: '', title: '', content: '',
      drive_url: '', effective_date: '', is_active: true, sort_order: 0,
    });
    setHasDraft(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category_id) { setStatus({ type: 'error', text: 'Please select a category.' }); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        sub_category_id: form.sub_category_id || null,
        drive_url: form.drive_url || null,
        effective_date: form.effective_date || null,
        created_by: userId,
      };
      if (editingItem) {
        await updateRule(editingItem.id, payload);
      } else {
        await createRule(payload);
        localStorage.removeItem('rule_form_draft');
        setHasDraft(false);
      }
      setStatus({ type: 'success', text: `Rule ${editingItem ? 'updated' : 'created'}!` });
      setTimeout(() => { onSave(); onClose(); }, 800);
    } catch (err) {
      setStatus({ type: 'error', text: `Error: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content hub-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
        <header className="modal-header">
          <h2>{editingItem ? 'Edit Rule' : 'New Rule'}</h2>
          <button className="close-modal" onClick={onClose}>&times;</button>
        </header>
        <form onSubmit={handleSubmit} className="vertical-task-form">
          <div className="modal-content-area">
            {hasDraft && (
              <div className="status-message success" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📝 Restored unfinished draft from your browser.</span>
                <button 
                  type="button" 
                  onClick={handleDiscardDraft} 
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem', textDecoration: 'underline' }}
                >
                  Discard Draft
                </button>
              </div>
            )}
            <div className="form-row-grid">
              <div className="form-group">
                <label>Category</label>
                <select
                  className="master-dropdown"
                  value={form.category_id}
                  onChange={e => setForm(p => ({ ...p, category_id: e.target.value, sub_category_id: '' }))}
                  required
                >
                  <option value="">— Select Category —</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon ? `${cat.icon} ` : ''}{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Sub-Category (optional)</label>
                <select
                  className="master-dropdown"
                  value={form.sub_category_id}
                  onChange={e => setForm(p => ({ ...p, sub_category_id: e.target.value }))}
                  disabled={filteredSubs.length === 0}
                >
                  <option value="">— None —</option>
                  {filteredSubs.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Rule Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Mandatory Safety Gear Policy"
                required
              />
            </div>
            <div className="form-group">
              <label>Content / Description</label>
              <textarea
                className="rule-form-textarea"
                value={form.content}
                onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                placeholder="Write the full rule text here. Supports plain text and line breaks."
              />
            </div>
            <div className="form-row-grid">
              <div className="form-group">
                <label>Google Drive URL (optional)</label>
                <input
                  type="url"
                  value={form.drive_url}
                  onChange={e => setForm(p => ({ ...p, drive_url: e.target.value }))}
                  placeholder="https://drive.google.com/..."
                />
              </div>
              <div className="form-group">
                <label>Effective Date</label>
                <input
                  type="date"
                  value={form.effective_date}
                  onChange={e => setForm(p => ({ ...p, effective_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-row-grid">
              <div className="form-group">
                <label>Sort Order</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
                  min={0}
                />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.25rem' }}>
                <label style={{ margin: 0 }}>Active</label>
                <button
                  type="button"
                  className={`rule-toggle ${form.is_active ? 'on' : ''}`}
                  onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                  title={form.is_active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                />
              </div>
            </div>
            <StatusMsg msg={status} />
          </div>
          <div className="modal-footer">
            <button type="button" className="halo-button cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="halo-button save-btn" disabled={saving}>
              {saving ? 'Saving...' : (editingItem ? 'Update Rule' : 'Create Rule')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Main Component ────────────────────────────────────────── */
const RuleManagement = ({ user, permissions, setActiveVertical, onShowBottomNav }) => {
  const [activeTab, setActiveTab] = useState('rules');

  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [catModal, setCatModal] = useState({ open: false, item: null });
  const [subModal, setSubModal] = useState({ open: false, item: null });
  const [ruleModal, setRuleModal] = useState({ open: false, item: null });

  // Rules tab filter
  const [filterCatId, setFilterCatId] = useState('all');
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, subs, rls] = await Promise.all([
        fetchCategories(),
        fetchSubCategories(),
        fetchRules({ activeOnly: false }),
      ]);
      setCategories(cats);
      setSubCategories(subs);
      setRules(rls);
    } catch (err) {
      console.error('[RuleManagement] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filtered rules for Rules tab ────────────────────────────
  const visibleRules = rules.filter(r => {
    const matchesCat = filterCatId === 'all' || r.category_id === filterCatId;
    const matchesActive = showInactive || r.is_active;
    return matchesCat && matchesActive;
  });

  // ── Delete helpers ───────────────────────────────────────────
  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Delete this category? All sub-categories and rules within it will also be deleted.')) return;
    try { await deleteCategory(id); load(); } catch (err) { alert(`Delete failed: ${err.message}`); }
  };

  const handleDeleteSubCategory = async (id) => {
    if (!window.confirm('Delete this sub-category? Linked rules will lose their sub-category.')) return;
    try { await deleteSubCategory(id); load(); } catch (err) { alert(`Delete failed: ${err.message}`); }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Permanently delete this rule?')) return;
    try { await deleteRule(id); load(); } catch (err) { alert(`Delete failed: ${err.message}`); }
  };

  const handleToggleRuleActive = async (rule) => {
    try {
      await toggleRuleActive(rule.id, !rule.is_active);
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    } catch (err) {
      alert(`Toggle failed: ${err.message}`);
    }
  };

  const tabs = [
    { id: 'rules', label: `Rules (${rules.length})` },
    { id: 'categories', label: `Categories (${categories.length})` },
    { id: 'subcategories', label: `Sub-Categories (${subCategories.length})` },
  ];

  return (
    <div className="management-view-container">
      {/* Inject inline styles */}
      <style>{inlineStyles}</style>

      <MasterPageHeader
        title="Rule Management"
        description="Create and manage employee rules, regulations, categories, and sub-categories."
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        rightActions={
          <button
            className="halo-button master-action-btn"
            onClick={() => {
              if (activeTab === 'rules') setRuleModal({ open: true, item: null });
              else if (activeTab === 'categories') setCatModal({ open: true, item: null });
              else setSubModal({ open: true, item: null });
            }}
          >
            {activeTab === 'rules' ? '+ New Rule' :
             activeTab === 'categories' ? '+ New Category' :
             '+ New Sub-Category'}
          </button>
        }
      />

      <div className="rule-mgmt-content">
        {/* ── Tabs ── */}
        <div className="rule-mgmt-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`rule-mgmt-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <div className="loading-spinner">Loading...</div>}

        {/* ──────────────────── RULES TAB ──────────────────────── */}
        {!loading && activeTab === 'rules' && (
          <>
            {/* Category filter */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div className="rule-cat-filter">
                <button
                  className={`rule-cat-filter-btn ${filterCatId === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterCatId('all')}
                >All</button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    className={`rule-cat-filter-btn ${filterCatId === cat.id ? 'active' : ''}`}
                    onClick={() => setFilterCatId(cat.id)}
                  >
                    {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                  </button>
                ))}
              </div>
              <button
                className={`halo-button secondary ${showInactive ? '' : 'hidden'}`}
                style={{ fontSize: '0.72rem', padding: '0.3rem 0.75rem' }}
                onClick={() => setShowInactive(prev => !prev)}
              >
                {showInactive ? 'Hide Inactive' : 'Show Inactive'}
              </button>
            </div>

            {visibleRules.length === 0 ? (
              <div className="rule-empty-panel">
                <p>No rules found. Click &quot;+ New Rule&quot; to add one.</p>
              </div>
            ) : (
              visibleRules.map(rule => {
                const catName = rule.category?.name || '—';
                const subName = rule.sub_category?.name;
                return (
                  <div key={rule.id} className={`rule-item-row ${!rule.is_active ? 'inactive-rule' : ''}`}>
                    <button
                      className={`rule-toggle ${rule.is_active ? 'on' : ''}`}
                      onClick={() => handleToggleRuleActive(rule)}
                      title={rule.is_active ? 'Active' : 'Inactive'}
                    />
                    <div className="rule-item-info">
                      <p className="rule-item-title">{rule.title}</p>
                      <div className="rule-item-meta">
                        <span className="rule-badge">{catName}</span>
                        {subName && <span className="rule-badge">{subName}</span>}
                        {rule.effective_date && (
                          <span className="rule-badge date-badge">
                            Eff: {new Date(rule.effective_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {rule.drive_url && <span className="rule-badge" style={{ color: 'var(--brand-green)' }}>📄 Drive</span>}
                      </div>
                    </div>
                    <div className="rule-item-actions">
                      <button className="icon-btn edit" onClick={() => setRuleModal({ open: true, item: rule })} title="Edit">✎</button>
                      <button className="icon-btn delete" onClick={() => handleDeleteRule(rule.id)} title="Delete">×</button>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ──────────────────── CATEGORIES TAB ─────────────────── */}
        {!loading && activeTab === 'categories' && (
          <div className="hubs-grid">
            {categories.map(cat => (
              <div key={cat.id} className="hub-card">
                <div className="hub-code-tag">{cat.icon || '📋'}</div>
                <h3>{cat.name}</h3>
                <p className="hub-city" style={{ whiteSpace: 'pre-wrap' }}>{cat.description || 'No description'}</p>
                <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '0.25rem' }}>
                  Order: {cat.sort_order}
                </p>
                <div className="hub-actions">
                  <button className="halo-button edit-btn" onClick={() => setCatModal({ open: true, item: cat })} title="Edit">✎</button>
                  <button className="halo-button delete-btn" onClick={() => handleDeleteCategory(cat.id)} title="Delete">×</button>
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <div className="rule-empty-panel">
                <p>No categories yet. Click &quot;+ New Category&quot; to get started.</p>
              </div>
            )}
          </div>
        )}

        {/* ──────────────────── SUB-CATEGORIES TAB ─────────────── */}
        {!loading && activeTab === 'subcategories' && (
          <div className="responsive-table-wrapper">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Sub-Category</th>
                  <th>Parent Category</th>
                  <th>Sort Order</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subCategories.map(sub => {
                  const parentCat = categories.find(c => c.id === sub.category_id);
                  return (
                    <tr key={sub.id}>
                      <td className="name-cell">{sub.name}</td>
                      <td>
                        <span className="rule-badge">
                          {parentCat?.icon ? `${parentCat.icon} ` : ''}{parentCat?.name || '—'}
                        </span>
                      </td>
                      <td><code className="code-font">{sub.sort_order}</code></td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-actions">
                          <button className="icon-btn edit" onClick={() => setSubModal({ open: true, item: sub })} title="Edit">✎</button>
                          <button className="icon-btn delete" onClick={() => handleDeleteSubCategory(sub.id)} title="Delete">×</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {subCategories.length === 0 && (
              <div className="rule-empty-panel">
                <p>No sub-categories yet. Click &quot;+ New Sub-Category&quot; to add one.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <CategoryFormModal
        isOpen={catModal.open}
        onClose={() => setCatModal({ open: false, item: null })}
        editingItem={catModal.item}
        onSave={load}
      />
      <SubCategoryFormModal
        isOpen={subModal.open}
        onClose={() => setSubModal({ open: false, item: null })}
        editingItem={subModal.item}
        categories={categories}
        onSave={load}
      />
      <RuleFormModal
        isOpen={ruleModal.open}
        onClose={() => setRuleModal({ open: false, item: null })}
        editingItem={ruleModal.item}
        categories={categories}
        subCategories={subCategories}
        userId={user?.id}
        onSave={load}
      />
    </div>
  );
};

export default RuleManagement;
