import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import MasterPageHeader from '../../components/MasterPageHeader';
import { fetchCategories, fetchSubCategories, fetchRules } from '../../services/employees/rulesService';
import CustomerVehicleRule from '../../features/tutorials/CustomerVehicleRule';
import './EmployeeRulesBoard.css';

/**
 * EmployeeRulesBoard
 *
 * Public-facing, read-only display of all employee rules & regulations.
 * Renders rules grouped by category → sub-category.
 * Features: keyword search, category filter pills, expandable rule cards.
 */

/* ─── Main Board ─────────────────────────────────────────────── */
const EmployeeRulesBoard = ({
  user,
  permissions,
  setActiveVertical,
  onShowBottomNav,
  isSubSidebarOpen,
  setIsSubSidebarOpen,
  SidebarComponent,
  onFilterChange,
  onReset,
  onBatchFilter,
  filters,
  verticals,
  activeVertical,
}) => {
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const sectionRefs = useRef({});

  // ── Data Fetch ──────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [cats, subs, rls] = await Promise.all([
          fetchCategories(),
          fetchSubCategories(),
          fetchRules({ activeOnly: true }),
        ]);
        setCategories(cats);
        setSubCategories(subs);
        setRules(rls);
      } catch (err) {
        console.error('[EmployeeRulesBoard] Load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Filter rules by active category pill & search query ─────
  const filteredRules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rules.filter(rule => {
      const matchesCategory =
        activeCategoryId === 'all' || rule.category_id === activeCategoryId;
      const matchesSearch =
        !q ||
        rule.title.toLowerCase().includes(q) ||
        (rule.content || '').toLowerCase().includes(q) ||
        (rule.category?.name || '').toLowerCase().includes(q) ||
        (rule.sub_category?.name || '').toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [rules, activeCategoryId, searchQuery]);

  // ── Group filtered rules: category → sub-category → rules ───
  const grouped = useMemo(() => {
    const catMap = {};

    filteredRules.forEach(rule => {
      const catId = rule.category_id;
      if (!catMap[catId]) {
        catMap[catId] = {
          category: rule.category,
          subMap: {},
          ungrouped: [],
        };
      }
      const subId = rule.sub_category_id || '__none__';
      if (subId === '__none__') {
        catMap[catId].ungrouped.push(rule);
      } else {
        if (!catMap[catId].subMap[subId]) {
          catMap[catId].subMap[subId] = {
            subCategory: rule.sub_category,
            rules: [],
          };
        }
        catMap[catId].subMap[subId].rules.push(rule);
      }
    });

    // Preserve sort_order from categories
    return categories
      .filter(cat => catMap[cat.id])
      .map(cat => ({
        ...catMap[cat.id],
        category: cat,
        subGroups: Object.values(catMap[cat.id]?.subMap || {}).sort((a, b) =>
          (a.subCategory?.name || '').localeCompare(b.subCategory?.name || '')
        ),
      }));
  }, [filteredRules, categories]);

  // ── Scroll to category section ───────────────────────────────
  const handlePillClick = useCallback((catId) => {
    setActiveCategoryId(catId);
    if (catId !== 'all' && sectionRefs.current[catId]) {
      sectionRefs.current[catId].scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // ── Render ───────────────────────────────────────────────────
  const totalVisible = filteredRules.length;

  return (
    <>
      <MasterPageHeader
        title="Rules & Regulations"
        description="Company-wide policies, conduct guidelines, and operational standards."
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        isSubSidebarOpen={isSubSidebarOpen}
        onSidebarToggle={setIsSubSidebarOpen}
        hideMenuClose={true}
        SidebarComponent={SidebarComponent}
        onFilterChange={onFilterChange}
        onReset={onReset}
        onBatchFilter={onBatchFilter}
        filters={filters}
        user={user}
        permissions={permissions}
        verticals={verticals}
        activeVertical={activeVertical}
      />

      <div className="rules-board-container">
        {/* ── Search ── */}
        <div className="rules-search-bar">
          <span className="rules-search-icon">🔍</span>
          <input
            type="text"
            className="rules-search-input"
            placeholder="Search rules, policies, guidelines..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* ── Category Pills ── */}
        {!loading && categories.length > 0 && (
          <div className="rules-category-pills">
            <button
              className={`rules-cat-pill ${activeCategoryId === 'all' ? 'active' : ''}`}
              onClick={() => handlePillClick('all')}
            >
              All Rules
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`rules-cat-pill ${activeCategoryId === cat.id ? 'active' : ''}`}
                onClick={() => handlePillClick(cat.id)}
              >
                {cat.icon && <span className="rules-cat-pill-icon">{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="rules-loading">Loading Rules & Regulations...</div>
        )}

        {/* ── Empty State (no rules at all) ── */}
        {!loading && rules.length === 0 && (
          <div className="rules-empty-state">
            <div className="rules-empty-icon">📋</div>
            <h3>No Rules Published Yet</h3>
            <p>
              {permissions?.canManageRoles
                ? 'Visit Configuration → Employee Manager → Rule Management to add rules.'
                : 'Check back later — company rules & regulations will appear here.'}
            </p>
          </div>
        )}

        {/* ── No Search Results ── */}
        {!loading && rules.length > 0 && totalVisible === 0 && (
          <div className="rules-no-results">
            No rules match &ldquo;{searchQuery}&rdquo;. Try a different search term.
          </div>
        )}

        {/* ── Category Sections ── */}
        {!loading && grouped.map(({ category, subGroups, ungrouped }) => {
          const totalInCat = subGroups.reduce((n, g) => n + g.rules.length, 0) + ungrouped.length;

          return (
            <div
              key={category.id}
              className="rules-category-section"
              ref={el => { sectionRefs.current[category.id] = el; }}
            >
              <div className="rules-category-header">
                {category.icon && (
                  <span className="rules-category-icon">{category.icon}</span>
                )}
                <h3 className="rules-category-title">{category.name}</h3>
                <span className="rules-category-count">{totalInCat}</span>
              </div>

              {/* Sub-category blocks */}
              {subGroups.map(({ subCategory, rules: subRules }) => (
                <div key={subCategory?.id} className="rules-subcategory-block">
                  <p className="rules-subcategory-label">
                    — {subCategory?.name}
                  </p>
                  <div className="rules-grid">
                    {subRules.map(rule => (
                      <CustomerVehicleRule key={rule.id} rule={rule} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Ungrouped rules (no sub-category) */}
              {ungrouped.length > 0 && (
                <div className="rules-grid">
                  {ungrouped.map(rule => (
                    <CustomerVehicleRule key={rule.id} rule={rule} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

export default EmployeeRulesBoard;
