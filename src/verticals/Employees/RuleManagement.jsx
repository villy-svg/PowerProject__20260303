import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MasterPageHeader from '../../components/layout/MasterPageHeader';
import { useIsMobile } from '../../hooks/useIsMobile';
import {
  fetchCategories,
  fetchSubCategories,
  fetchRules,
  deleteCategory,
  deleteSubCategory,
  deleteRule,
  toggleRuleActive,
} from '../../services/employees/rulesService';
import './EmployeeRulesBoard.css'; // Canonical .rule-badge & .date-badge (same vertical)
import './RuleManagement.css';
import CategoryFormModal from './CategoryFormModal';
import SubCategoryFormModal from './SubCategoryFormModal';
import RuleFormModal from './RuleFormModal';

const formatEffectiveDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const TAB_CREATE_META = {
  rules: { type: 'rule', label: 'New Rule' },
  categories: { type: 'category', label: 'New Category' },
  subcategories: { type: 'subcategory', label: 'New Sub-Category' },
};

/* ─── Main Component ────────────────────────────────────────── */
const RuleManagement = ({ user, permissions = {}, setActiveVertical, onShowBottomNav }) => {
  const { isMobile } = useIsMobile();
  const [activeTab, setActiveTab] = useState('rules');

  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  // Unified modal state (only one modal can be open at a time)
  const [activeModal, setActiveModal] = useState({ type: null, item: null });

  // Rules tab filters
  const [filterCatId, setFilterCatId] = useState('all');
  const [showInactive, setShowInactive] = useState(false);

  const canCreate = permissions?.canCreate !== false;
  const canUpdate = permissions?.canUpdate !== false;
  const canDelete = permissions?.canDelete !== false;

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

  useEffect(() => {
    load();
  }, [load]);

  // O(1) lookup map for parent categories in Sub-Categories tab
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  // ── Filtered rules for Rules tab ────────────────────────────
  const visibleRules = useMemo(
    () =>
      rules.filter((r) => {
        const matchesCat = filterCatId === 'all' || r.category_id === filterCatId;
        const matchesActive = showInactive || r.is_active;
        return matchesCat && matchesActive;
      }),
    [rules, filterCatId, showInactive]
  );

  // ── Unified modal helpers ───────────────────────────────────
  const closeModal = useCallback(() => setActiveModal({ type: null, item: null }), []);

  const currentCreateMeta = TAB_CREATE_META[activeTab] || TAB_CREATE_META.rules;
  const handleOpenCreateModal = useCallback(() => {
    setActiveModal({ type: currentCreateMeta.type, item: null });
  }, [currentCreateMeta.type]);

  // ── Shared delete helper ────────────────────────────────────
  const handleDelete = async (confirmMsg, deleteFn, id) => {
    if (!window.confirm(confirmMsg)) return;
    try {
      await deleteFn(id);
      load();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // ── Active toggle with in-flight guard & rollback ───────────
  const handleToggleRuleActive = async (rule) => {
    if (togglingId === rule.id) return;
    const nextActive = !rule.is_active;
    setTogglingId(rule.id);
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: nextActive } : r)));
    try {
      await toggleRuleActive(rule.id, nextActive);
    } catch (err) {
      // Roll back optimistic update on failure
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: rule.is_active } : r)));
      alert(`Toggle failed: ${err.message}`);
    } finally {
      setTogglingId(null);
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
        canAdd={canCreate}
        addLabel={currentCreateMeta.label}
        onAddClick={handleOpenCreateModal}
        rightActions={
          canCreate && (
            <button
              className="halo-button master-action-btn"
              onClick={handleOpenCreateModal}
            >
              + {currentCreateMeta.label}
            </button>
          )
        }
      />

      <div className="rule-mgmt-content">
        {/* ── Tabs ── */}
        <div className="rule-mgmt-tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`rule-mgmt-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <div className="loading-spinner">Loading...</div>}

        {!loading && loadError && (
          <div className="rule-empty-panel is-error">
            <p>⚠️ {loadError}</p>
          </div>
        )}

        {/* ──────────────────── RULES TAB ──────────────────────── */}
        {!loading && !loadError && activeTab === 'rules' && (
          <>
            <div className="rule-filter-toolbar">
              <div className="rule-cat-filter">
                <button
                  type="button"
                  className={`rule-cat-filter-btn ${filterCatId === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterCatId('all')}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`rule-cat-filter-btn ${filterCatId === cat.id ? 'active' : ''}`}
                    onClick={() => setFilterCatId(cat.id)}
                  >
                    {cat.icon ? `${cat.icon} ` : ''}
                    {cat.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="halo-button secondary rule-inactive-toggle-btn"
                onClick={() => setShowInactive((prev) => !prev)}
              >
                {showInactive ? 'Hide Inactive' : 'Show Inactive'}
              </button>
            </div>

            {visibleRules.length === 0 ? (
              <div className="rule-empty-panel">
                <p>No rules found. Tap &quot;+ New Rule&quot; to add one.</p>
              </div>
            ) : (
              visibleRules.map((rule) => {
                const catName = rule.category?.name || '—';
                const subName = rule.sub_category?.name;
                return (
                  <div
                    key={rule.id}
                    className={`rule-item-row ${!rule.is_active ? 'inactive-rule' : ''}`}
                  >
                    <div className="rule-item-toggle-wrap">
                      <button
                        type="button"
                        className={`rule-toggle ${rule.is_active ? 'on' : ''}`}
                        onClick={() => handleToggleRuleActive(rule)}
                        disabled={!canUpdate || togglingId === rule.id}
                        title={rule.is_active ? 'Active' : 'Inactive'}
                        aria-label={rule.is_active ? 'Deactivate rule' : 'Activate rule'}
                        aria-pressed={rule.is_active}
                      />
                    </div>
                    <div className="rule-item-info">
                      <p className="rule-item-title">{rule.title}</p>
                      <div className="rule-item-meta">
                        <span className="rule-badge">{catName}</span>
                        {subName && <span className="rule-badge">{subName}</span>}
                        {rule.impact && (
                          <span className="rule-badge impact-badge">
                            Impact: {rule.impact}
                          </span>
                        )}
                        {rule.effective_date && (
                          <span className="rule-badge date-badge">
                            Eff: {formatEffectiveDate(rule.effective_date)}
                          </span>
                        )}
                        {rule.drive_url && (
                          <span className="rule-badge drive-badge">📄 Drive</span>
                        )}
                      </div>
                    </div>
                    {(canUpdate || canDelete) && (
                      <div className="rule-item-actions">
                        {canUpdate && (
                          <button
                            type="button"
                            className="rule-action-btn edit"
                            onClick={() => setActiveModal({ type: 'rule', item: rule })}
                            title="Edit Rule"
                            aria-label={`Edit ${rule.title}`}
                          >
                            ✎
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="rule-action-btn delete"
                            onClick={() =>
                              handleDelete('Permanently delete this rule?', deleteRule, rule.id)
                            }
                            title="Delete Rule"
                            aria-label={`Delete ${rule.title}`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ──────────────────── CATEGORIES TAB ─────────────────── */}
        {!loading && !loadError && activeTab === 'categories' && (
          categories.length === 0 ? (
            <div className="rule-empty-panel">
              <p>No categories yet. Tap &quot;+ New Category&quot; to get started.</p>
            </div>
          ) : (
            <div className="rule-categories-grid">
              {categories.map((cat) => (
                <div key={cat.id} className="rule-category-card">
                  <div className="rule-category-card-top">
                    <span className="rule-category-icon">{cat.icon || '📋'}</span>
                    {(canUpdate || canDelete) && (
                      <div className="rule-item-actions">
                        {canUpdate && (
                          <button
                            type="button"
                            className="rule-action-btn edit"
                            onClick={() => setActiveModal({ type: 'category', item: cat })}
                            title="Edit Category"
                            aria-label={`Edit ${cat.name}`}
                          >
                            ✎
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="rule-action-btn delete"
                            onClick={() =>
                              handleDelete(
                                'Delete this category? All sub-categories and rules within it will also be deleted.',
                                deleteCategory,
                                cat.id
                              )
                            }
                            title="Delete Category"
                            aria-label={`Delete ${cat.name}`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="rule-category-name">{cat.name}</p>
                  <p className="rule-category-desc">{cat.description || 'No description'}</p>
                  <p className="rule-category-order">Order: {cat.sort_order}</p>
                </div>
              ))}
            </div>
          )
        )}

        {/* ──────────────────── SUB-CATEGORIES TAB ─────────────── */}
        {!loading && !loadError && activeTab === 'subcategories' && (
          subCategories.length === 0 ? (
            <div className="rule-empty-panel">
              <p>No sub-categories yet. Tap &quot;+ New Sub-Category&quot; to add one.</p>
            </div>
          ) : isMobile ? (
            /* Adaptive mobile card list (no horizontal-scrolling 900px table on phone) */
            <div className="rule-subcat-list">
              {subCategories.map((sub) => {
                const parentCat = categoryById.get(sub.category_id);
                return (
                  <div key={sub.id} className="rule-subcat-card">
                    <div className="rule-subcat-card-info">
                      <p className="rule-subcat-card-name">{sub.name}</p>
                      <div className="rule-item-meta">
                        <span className="rule-badge">
                          {parentCat?.icon ? `${parentCat.icon} ` : ''}
                          {parentCat?.name || '—'}
                        </span>
                        <code className="rule-subcat-order-code">Order: {sub.sort_order}</code>
                      </div>
                    </div>
                    {(canUpdate || canDelete) && (
                      <div className="rule-item-actions">
                        {canUpdate && (
                          <button
                            type="button"
                            className="rule-action-btn edit"
                            onClick={() => setActiveModal({ type: 'subcategory', item: sub })}
                            title="Edit Sub-Category"
                            aria-label={`Edit ${sub.name}`}
                          >
                            ✎
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="rule-action-btn delete"
                            onClick={() =>
                              handleDelete(
                                'Delete this sub-category? Linked rules will lose their sub-category.',
                                deleteSubCategory,
                                sub.id
                              )
                            }
                            title="Delete Sub-Category"
                            aria-label={`Delete ${sub.name}`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rule-subcat-table-wrap">
              <table className="rule-subcat-table">
                <thead>
                  <tr>
                    <th>Sub-Category</th>
                    <th>Parent Category</th>
                    <th>Sort Order</th>
                    <th className="rule-subcat-actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subCategories.map((sub) => {
                    const parentCat = categoryById.get(sub.category_id);
                    return (
                      <tr key={sub.id}>
                        <td className="rule-subcat-name">{sub.name}</td>
                        <td>
                          <span className="rule-badge">
                            {parentCat?.icon ? `${parentCat.icon} ` : ''}
                            {parentCat?.name || '—'}
                          </span>
                        </td>
                        <td>
                          <code className="rule-subcat-order-code">{sub.sort_order}</code>
                        </td>
                        <td className="rule-subcat-actions-col">
                          <div className="rule-item-actions">
                            {canUpdate && (
                              <button
                                type="button"
                                className="rule-action-btn edit"
                                onClick={() => setActiveModal({ type: 'subcategory', item: sub })}
                                title="Edit Sub-Category"
                              >
                                ✎
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                className="rule-action-btn delete"
                                onClick={() =>
                                  handleDelete(
                                    'Delete this sub-category? Linked rules will lose their sub-category.',
                                    deleteSubCategory,
                                    sub.id
                                  )
                                }
                                title="Delete Sub-Category"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* ── Modals ── */}
      <CategoryFormModal
        isOpen={activeModal.type === 'category'}
        onClose={closeModal}
        editingItem={activeModal.type === 'category' ? activeModal.item : null}
        onSave={load}
      />
      <SubCategoryFormModal
        isOpen={activeModal.type === 'subcategory'}
        onClose={closeModal}
        editingItem={activeModal.type === 'subcategory' ? activeModal.item : null}
        categories={categories}
        onSave={load}
      />
      <RuleFormModal
        isOpen={activeModal.type === 'rule'}
        onClose={closeModal}
        editingItem={activeModal.type === 'rule' ? activeModal.item : null}
        categories={categories}
        subCategories={subCategories}
        userId={user?.id}
        onSave={load}
      />
    </div>
  );
};

export default RuleManagement;
