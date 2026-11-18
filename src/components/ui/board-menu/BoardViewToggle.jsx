import React from 'react';
import './BoardMenu.css';

/**
 * BoardViewToggle
 *
 * Standardized segmented view switcher for MasterPageHeader expanded menus.
 * Enforces uniform 36px outer height, 28px inner segment height, and 0.75rem uppercase typography,
 * while supporting board-specific addons (such as the "| By Hub" grouping toggle on Hub boards).
 *
 * Props:
 *   options      {Array<string | { value: string, label: string, title?: string }>} - View modes
 *   value        {string}   - Currently active view mode
 *   onChange     {function} - (nextMode) => void
 *   addon        {node}     - Optional board-specific toggle rendered after a vertical separator
 *   showDivider  {boolean}  - Whether to render a separator before addon/children (default: true)
 *   ariaLabel    {string}   - Accessible group label (default: 'View mode')
 *   className    {string}   - Optional scoped modifier class
 *   children     {node}     - Optional additional controls
 */
const BoardViewToggle = ({
  options = [],
  value,
  onChange,
  addon = null,
  showDivider = true,
  ariaLabel = 'View mode',
  className = '',
  children = null,
}) => {
  const normalizedOptions = (options || []).map((opt) =>
    typeof opt === 'string'
      ? { value: opt, label: opt, title: `${opt.charAt(0).toUpperCase() + opt.slice(1)} View` }
      : opt
  );

  const extraContent = addon || children;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`board-view-toggle view-mode-toggle ${className}`.trim()}
    >
      {normalizedOptions.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isActive}
            className={`board-view-toggle__btn view-toggle-btn ${isActive ? 'active' : ''} ${opt.className || ''}`.trim()}
            onClick={() => onChange && onChange(opt.value)}
            title={opt.title || opt.label}
          >
            {opt.label}
          </button>
        );
      })}

      {Boolean(extraContent) && (
        <>
          {showDivider && (
            <span
              role="separator"
              aria-orientation="vertical"
              className="view-toggle-divider mobile-hidden"
            />
          )}
          {extraContent}
        </>
      )}
    </div>
  );
};

export default BoardViewToggle;
