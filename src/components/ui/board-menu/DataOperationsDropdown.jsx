import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IconChevronDown } from '../Icons';
import './BoardMenu.css';

/**
 * DataOperationsDropdown
 *
 * Modular dropdown container for board-level bulk/CSV/admin operations in MasterPageHeader.
 * - Controlled by default (if `isOpen` & `onToggle` are passed), uncontrolled as fallback.
 * - Matches the exact 36px height and 0.75rem uppercase typography of left-side menu controls.
 * - Keeps `.actions-dropdown-menu` mounted in the DOM (toggled via `.is-open` / `.is-closed`)
 *   so MobileHeader's Quick Actions bottom sheet (`.expanded-actions-list`) can flatten and
 *   display all action buttons inline without extra clicks.
 */
const DataOperationsDropdown = ({
  label = 'Data Operations',
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
  className = '',
  children,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledIsOpen === 'boolean';
  const isOpen = isControlled ? controlledIsOpen : internalOpen;

  const containerRef = useRef(null);
  const triggerRef = useRef(null);

  const setOpenState = useCallback(
    (nextVal) => {
      const resolved = typeof nextVal === 'function' ? nextVal(isOpen) : nextVal;
      if (isControlled) {
        if (controlledOnToggle) controlledOnToggle(resolved);
      } else {
        setInternalOpen(resolved);
      }
    },
    [isControlled, isOpen, controlledOnToggle]
  );

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpenState(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpenState(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setOpenState]);

  return (
    <div className={`data-operations-wrapper ${className}`.trim()} ref={containerRef}>
      <div className="actions-dropdown-container">
        <button
          ref={triggerRef}
          type="button"
          className={`data-ops-trigger filters-row-toggle ${isOpen ? 'is-open' : ''}`.trim()}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setOpenState(!isOpen)}
        >
          <span className="data-ops-trigger__label u-uppercase">{label}</span>
          <span
            className={`data-ops-chevron dropdown-chevron-icon ${isOpen ? 'is-open' : ''}`.trim()}
            aria-hidden="true"
          >
            <IconChevronDown size={12} />
          </span>
        </button>

        <div
          className={`actions-dropdown-menu ${isOpen ? 'is-open' : 'is-closed'}`.trim()}
          role="menu"
          aria-label={label}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default DataOperationsDropdown;
