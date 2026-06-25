import React, { useState, useEffect, useCallback } from 'react';
import MasterPageHeader from '../../components/layout/MasterPageHeader';
import {
  fetchCategories,
  fetchSubCategories,
  fetchRules,
  deleteCategory,
  deleteSubCategory,
  deleteRule, toggleRuleActive,
} from '../../services/employees/rulesService';
import '../ChargingHubs/HubFunctionManagement.css'; // Shared management styles
import './EmployeeRulesBoard.css'; // Badge styles
import './RuleManagement.css'; // Tab & Row styles
import CategoryFormModal from './CategoryFormModal';
import SubCategoryFormModal from './SubCategoryFormModal';
import RuleFormModal from './RuleFormModal';

/* ─── Main Component ────────────────────────────────────────── */
const RuleManagement = ({ user, setActiveVertical, onShowBottomNav }) => {
  const [activeTab, setActiveTab] = useState('rules');

  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

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
      setLoadError(null);
    } catch (err) {
      console.error('[RuleManagement] Load error:', err);
      setLoadError('Failed to load rules data. Please refresh and try again.');
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

        {!loading && loadError && (
          <div className="rule-empty-panel" style={{ color: 'var(--error-color, #ef4444)', opacity: 1 }}>
            <p>⚠️ {loadError}</p>
          </div>
        )}

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
                className="halo-button secondary"
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
                        {rule.impact && (
                          <span className="rule-badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', whiteSpace: 'pre-wrap' }}>
                            Impact: {rule.impact}
                          </span>
                        )}
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
