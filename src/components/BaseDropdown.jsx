import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/DropdownSystem.css';

/**
 * BaseDropdown
 * 
 * The unified dropdown engine for the PowerProject application.
 * Designed to absorb the union of features from CustomSelect, HubSelector, and AssigneeSelector.
 * 
 * Major Feature Groups:
 * - Mode: 'single' | 'multi'
 * - Search: searchable, fuzzySearch, searchKeys
 * - Layout: fullWidthDropdown, dropdownMaxHeight
 * - Select All: selectAll, maxSelect
 * - Display: pills, count, compact
 */
const BaseDropdown = ({
  // ── IDENTITY
  id = '',
  className = '',

  // ── DATA
  options = [],
  value,
  onChange,

  // ── MODE
  mode = 'single',

  // ── SEARCH
  searchable = true,
  searchPlaceholder = 'Search...',
  fuzzySearch = true,
  searchKeys = ['label'],

  // ── LABEL / DISPLAY
  placeholder = 'Select...',
  getLabel = null,
  displayMode = 'compact',
  currentUser = null,

  // ── MULTI-SELECT FEATURES
  selectAll = false,
  maxSelect = null,
  limitToIds = null,
  loadMoreLabel = '+ Load more...',

  // ── LAYOUT
  fullWidthDropdown = false,
  dropdownMaxHeight = 280,

  // ── ITEM RENDERING
  renderItem = null,
  showCheckbox = true,
  groupBy = null,

  // ── CLEAR
  clearable = false,

  // ── FILTER
  filterFn = null,

  // ── KEYBOARD NAV  [FORWARD-LOOKING — default false]
  keyboardNav = false,

  // ── CONTROLLED OPEN STATE  [FORWARD-LOOKING — default undefined/null]
  isOpen: controlledIsOpen = undefined,
  onOpenChange = null,

  // ── SLOTS  [FORWARD-LOOKING — default null]
  emptyState = null,
  footerSlot = null,

  // ── STATE
  disabled = false,
  required = false,
  loading = false,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;

  const setIsOpen = useCallback((next) => {
    if (controlledIsOpen !== undefined) {
      if (onOpenChange) onOpenChange(next);
    } else {
      setInternalOpen(next);
    }
  }, [controlledIsOpen, onOpenChange]);

  const [searchTerm, setSearchTerm] = useState('');
  const [showAll, setShowAll] = useState(!limitToIds);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedValues = mode === 'single'
    ? (value && value !== '' ? [value] : [])
    : (Array.isArray(value) ? value : (value ? [value] : []));

  useEffect(() => {
    if (isOpen && searchable && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setFocusedIndex(-1);
      setShowAll(!limitToIds);
    }
  }, [isOpen, limitToIds]);

  useEffect(() => {
    if (isOpen && fullWidthDropdown && containerRef.current && dropdownRef.current) {
      const modalContent = containerRef.current.closest('.modal-content-area') || containerRef.current.closest('.modal-content');
      if (modalContent) {
        const modalRect = modalContent.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        dropdownRef.current.style.width = `${modalRect.width - 64}px`;
        dropdownRef.current.style.left = `${modalRect.left - containerRect.left + 32}px`;
        dropdownRef.current.style.right = 'auto';
      }
    }
  }, [isOpen, fullWidthDropdown]);

  useEffect(() => {
    setShowAll(!limitToIds);
  }, [limitToIds]);

  const fuzzyMatch = (str, pattern) => {
    if (!pattern) return true;
    if (!str) return false;
    if (!fuzzySearch) return str.toLowerCase().includes(pattern.toLowerCase());
    
    const p = pattern.toLowerCase();
    const s = str.toLowerCase();
    let pIdx = 0;
    let sIdx = 0;
    while (pIdx < p.length && sIdx < s.length) {
      if (p[pIdx] === s[sIdx]) pIdx++;
      sIdx++;
    }
    return pIdx === p.length;
  };

  const filteredOptions = options.filter(opt => {
    if (filterFn && !filterFn(opt)) return false;
    if (!searchTerm) return true;
    return searchKeys.some(key => fuzzyMatch(String(opt[key] || ''), searchTerm));
  });

  const visibleOptions = limitToIds
    ? filteredOptions.filter(opt => limitToIds.includes(opt.value))
    : filteredOptions;

  const hiddenOptions = limitToIds
    ? filteredOptions.filter(opt => !limitToIds.includes(opt.value))
    : [];

  const displayedOptions = showAll ? filteredOptions : visibleOptions;

  const allFilteredSelected =
    displayedOptions.length > 0 &&
    displayedOptions.every(opt => selectedValues.includes(opt.value));

  const handleSelectAll = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (allFilteredSelected) {
      const toRemove = displayedOptions.map(opt => opt.value);
      const newSelection = selectedValues.filter(val => !toRemove.includes(val));
      onChange(newSelection);
    } else {
      let newSelection = [...selectedValues];
      for (const opt of displayedOptions) {
        if (!newSelection.includes(opt.value)) {
          if (maxSelect !== null && newSelection.length >= maxSelect) break;
          newSelection.push(opt.value);
        }
      }
      onChange(newSelection);
    }
  };

  const toggleOption = (val) => {
    if (disabled) return;
    if (mode === 'single') {
      onChange(val);
      setIsOpen(false);
      return;
    }
    
    let newSelection;
    if (selectedValues.includes(val)) {
      newSelection = selectedValues.filter(v => v !== val);
    } else {
      if (maxSelect !== null && selectedValues.length >= maxSelect) return;
      newSelection = [...selectedValues, val];
    }
    onChange(newSelection);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onChange(mode === 'single' ? '' : []);
  };

  const computeLabel = () => {
    if (loading) return 'Loading...';
    if (getLabel) return getLabel(selectedValues, options);

    if (displayMode === 'count') {
      return selectedValues.length === 0 ? placeholder : `${selectedValues.length} selected`;
    }

    if (selectedValues.length === 0) return placeholder;

    if (mode === 'single') {
      const opt = options.find(o => o.value === selectedValues[0]);
      return opt ? opt.label : placeholder;
    }

    const primaryOpt = options.find(o => o.value === selectedValues[0]);
    if (primaryOpt) {
      const primaryLabel = primaryOpt.label;
      if (selectedValues.length === 1) return primaryLabel;
      return `${primaryLabel} + ${selectedValues.length - 1}`;
    }

    return `${selectedValues.length} selected`;
  };

  const handleKeyDown = (e) => {
    if (!keyboardNav || disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setFocusedIndex(prev => (prev < displayedOptions.length - 1 ? prev + 1 : prev));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (isOpen && focusedIndex >= 0 && focusedIndex < displayedOptions.length) {
        e.preventDefault();
        toggleOption(displayedOptions[focusedIndex].value);
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    }
  };

  const renderGroupedOptions = (optList) => {
    if (!groupBy) {
      return optList.map((opt, idx) => renderOptionItem(opt, idx));
    }

    const groups = optList.reduce((acc, opt) => {
      const key = opt[groupBy] || 'Other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(opt);
      return acc;
    }, {});

    let globalIdx = 0;
    return Object.entries(groups).map(([groupName, groupOpts]) => (
      <div className="bd-option-group" key={groupName}>
        <div className="bd-option-group-header">{groupName}</div>
        {groupOpts.map(opt => {
          const idx = globalIdx++;
          return renderOptionItem(opt, idx);
        })}
      </div>
    ));
  };

  const renderOptionItem = (opt, idx) => {
    const isSelected = selectedValues.includes(opt.value);
    const isAtMax = maxSelect !== null && selectedValues.length >= maxSelect && !isSelected;
    const isFocused = focusedIndex === idx;

    if (renderItem) {
      return (
        <div
          key={opt.value}
          id={`${id}-option-${opt.value}`}
          role="option"
          aria-selected={isSelected}
          className={`bd-option custom-dropdown-option ${isSelected ? 'selected' : ''} ${isAtMax ? 'at-max' : ''} ${isFocused ? 'focused' : ''} ${mode === 'single' ? 'single' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (!isAtMax) toggleOption(opt.value);
          }}
        >
          {renderItem(opt, isSelected, mode)}
        </div>
      );
    }

    return (
      <div
        key={opt.value}
        id={`${id}-option-${opt.value}`}
        role="option"
        aria-selected={isSelected}
        className={`bd-option custom-dropdown-option ${isSelected ? 'selected' : ''} ${isAtMax ? 'at-max' : ''} ${isFocused ? 'focused' : ''} ${mode === 'single' ? 'single' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!isAtMax) toggleOption(opt.value);
        }}
      >
        {showCheckbox && (
          <div className="custom-dropdown-checkbox">
            {isSelected && (mode === 'single' ? <div className="radio-dot" /> : '✓')}
          </div>
        )}
        <div className="bd-option-content">
          <span className="custom-dropdown-text">{opt.label}</span>
          {opt.sublabel && <span className="bd-option-sublabel">{opt.sublabel}</span>}
        </div>
      </div>
    );
  };

  const renderTriggerLabel = () => {
    if (displayMode === 'pills' && selectedValues.length > 0) {
      return (
        <div className="bd-pills-container">
          {selectedValues.map(val => {
            const opt = options.find(o => o.value === val);
            const label = opt ? opt.label : val;
            return (
              <span className="bd-pill" key={val}>
                {label}
                <button
                  type="button"
                  className="bd-pill-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleOption(val);
                  }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      );
    }
    return <span className="selected-label">{computeLabel()}</span>;
  };

  return (
    <div 
      className={`bd-container custom-select-container ${isOpen ? 'open' : ''} ${className}`} 
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {/* TRIGGER OR SEARCH INPUT */}
      {isOpen && searchable ? (
        <div className="custom-select-search-wrapper">
          <input 
            ref={inputRef}
            type="text"
            className="custom-select-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
            onClick={(e) => e.stopPropagation()}
          />
          <button 
            type="button" 
            className="custom-select-clear-btn" 
            onClick={(e) => { 
              e.stopPropagation(); 
              setSearchTerm(''); 
            }}
            style={{ visibility: searchTerm ? 'visible' : 'hidden' }}
          >
            ×
          </button>
        </div>
      ) : (
        <button 
          type="button"
          id={id}
          className={`bd-trigger custom-select-trigger ${disabled ? 'disabled' : ''} ${loading ? 'loading' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setIsOpen(true);
          }}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-required={required}
          disabled={disabled}
        >
          {renderTriggerLabel()}
          <div className="bd-trigger-actions">
            {clearable && selectedValues.length > 0 && !disabled && (
              <button type="button" className="bd-clear-btn" onClick={handleClear}>×</button>
            )}
            <span className="dropdown-arrow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </div>
        </button>
      )}

      {/* DROPDOWN PANEL */}
      {isOpen && !disabled && (
        <>
          <div 
            className="selector-backdrop" 
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsOpen(false);
            }}
          />
          <div 
            className="bd-menu custom-dropdown-menu fade-in" 
            ref={dropdownRef}
            role="listbox" 
            aria-multiselectable={mode === 'multi'} 
            style={{ maxHeight: dropdownMaxHeight }}
          >
            {/* SELECT ALL — only when selectAll && mode==='multi' */}
            {selectAll && mode === 'multi' && displayedOptions.length > 0 && (
              <button type="button" className="bd-select-all-btn" onClick={handleSelectAll}>
                {allFilteredSelected ? 'Deselect All' : 'Select All'}
              </button>
            )}

            {/* OPTIONS */}
            {displayedOptions.length === 0 ? (
              emptyState
                ? <div className="bd-empty-state">{emptyState}</div>
                : <div className="no-options" style={{ padding: '15px', textAlign: 'center', opacity: 0.5 }}>No options available</div>
            ) : (
              renderGroupedOptions(displayedOptions)
            )}

            {/* LOAD MORE EXPANDER — only when limitToIds is set */}
            {limitToIds && !showAll && hiddenOptions.length > 0 && (
              <button 
                type="button" 
                className="load-others-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAll(true);
                }}
              >
                {loadMoreLabel} ({hiddenOptions.length})
              </button>
            )}

            {/* FOOTER SLOT */}
            {footerSlot && <div className="bd-footer-slot">{footerSlot}</div>}
          </div>
        </>
      )}
    </div>
  );
};

export default BaseDropdown;
