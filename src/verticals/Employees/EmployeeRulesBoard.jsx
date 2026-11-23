import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import MasterPageHeader from '../../components/layout/MasterPageHeader';
import { fetchCategories, fetchSubCategories, fetchRules } from '../../services/employees/rulesService';
import './EmployeeRulesBoard.css';
import RBACManageButton from '../../components/ui/RBACManageButton';
import FormattedText from '../../features/tutorials/FormattedText';

/* ─── Static Rule Tile Component ────────────────────────────── */
const RuleCard = ({ rule, hideSubBadge = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // Format explicit tutorial page breaks cleanly for static rule card view
  const content = (rule.content || '').replace(/\n?---PAGE_BREAK---\n?/g, '\n\n').replace(/^### /gm, '').trim();
  const hasContent = content.length > 0;
  // Trigger expand toggle when content exceeds ~3 lines on mobile or 140 chars
  const isLongContent = content.length > 140 || content.split('\n').length > 3;
  // Avoid repeating sub-category chip when card is already under its sub-category heading
  const showSubBadge = !hideSubBadge && Boolean(rule.sub_category?.name);

  return (
    <div className="rule-card">
      {/* Zone 1: The Rule Title */}
      <div className="rule-card-header u-flex-col">
        <h4 className="rule-card-title">{rule.title}</h4>
        {showSubBadge && (
          <div className="rule-card-badges">
            <span className="rule-badge">{rule.sub_category.name}</span>
          </div>
        )}
      </div>

      {/* Zone 2: Rule Details / Translation (Primary readable content) */}
      {hasContent && (
        <div className="rule-card-details">
          <div className={`rule-card-content ${!isExpanded && isLongContent ? 'collapsed' : ''}`}>
            <FormattedText text={content} />
          </div>

          {isLongContent && (
            <button
              type="button"
              className="rule-expand-btn"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
            >
              <span>{isExpanded ? 'Show Less' : 'Read More'}</span>
              <span className="rule-expand-chevron" aria-hidden="true">
                {isExpanded ? '↑' : '↓'}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Zone 3: Compact Consequence Note (Secondary semantic accent) */}
      {rule.impact && (
        <div className="rule-impact-callout">
          <span className="rule-impact-kicker" aria-hidden="true">Consequence</span>
          <div className="rule-impact-body">{rule.impact}</div>
        </div>
      )}

      {rule.drive_url && (
        <a
          href={rule.drive_url}
          target="_blank"
          rel="noopener noreferrer"
          className="rule-drive-link"
        >
          📄 View Full Document ↗
        </a>
      )}
    </div>
  );
};

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
  const [loadError, setLoadError] = useState(null);
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
        setLoadError(null);
      } catch (err) {
        console.error('[EmployeeRulesBoard] Load error:', err);
        setLoadError('Could not load rules. Please check your connection and refresh.');
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
      .map(cat => {
        const entry = catMap[cat.id];
        
        // Sort rules inside each subcategory
        const subGroups = Object.values(entry.subMap || {}).map(group => {
          const sortedRules = [...group.rules].sort((a, b) => 
            Number(a.sort_order || 0) - Number(b.sort_order || 0)
          );
          return {
            ...group,
            rules: sortedRules
          };
        }).sort((a, b) => {
          const subA = subCategories.find(s => s.id === a.subCategory?.id);
          const subB = subCategories.find(s => s.id === b.subCategory?.id);
          const orderA = subA ? Number(subA.sort_order || 0) : 0;
          const orderB = subB ? Number(subB.sort_order || 0) : 0;
          return (orderA - orderB) || (a.subCategory?.name || '').localeCompare(b.subCategory?.name || '');
        });

        // Sort ungrouped rules
        const sortedUngrouped = [...entry.ungrouped].sort((a, b) => 
          Number(a.sort_order || 0) - Number(b.sort_order || 0)
        );

        return {
          category: cat,
          subGroups,
          ungrouped: sortedUngrouped
        };
      });
  }, [filteredRules, categories, subCategories]);

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
        hideSearchBar={true}
        rightActions={
          /* Master Admin: Manage RBAC for Rules Board */
          <RBACManageButton 
            user={user} 
            verticalId="EMPLOYEES" 
            featureId="canAccessEmployeeRulesBoard" 
            label="Rules & Regulations" 
          />
        }
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

        {/* ── Load Error ── */}
        {!loading && loadError && (
          <div className="rules-empty-state">
            <div className="rules-empty-icon">⚠️</div>
            <h3>Failed to Load</h3>
            <p>{loadError}</p>
          </div>
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
                      <RuleCard key={rule.id} rule={rule} hideSubBadge={true} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Ungrouped rules (no sub-category) */}
              {ungrouped.length > 0 && (
                <div className="rules-grid">
                  {ungrouped.map(rule => (
                    <RuleCard key={rule.id} rule={rule} />
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
