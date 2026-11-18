import React from 'react';
import './BoardMenu.css';

/**
 * BoardFilterPill & BoardFilterGroup
 *
 * Standardized standalone toggle chip for board header menus (e.g., Defer, My Tasks, Rework, Inactive).
 * Eliminates the 3-way CSS collision between .halo-button, .expanded-menu-row .halo-button,
 * and .toggle-depri-btn while supporting board-specific semantic variants.
 */
export const BoardFilterGroup = ({
  children,
  ariaLabel = 'Board filters',
  className = '',
}) => {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`board-filter-group header-filter-group ${className}`.trim()}
    >
      {children}
    </div>
  );
};

const BoardFilterPill = ({
  active = false,
  onClick,
  title,
  variant = 'default',
  icon = null,
  className = '',
  children,
}) => {
  const isActive = Boolean(active);
  const variantClass =
    variant && variant !== 'default' ? `board-filter-pill--${variant}` : '';

  return (
    <button
      type="button"
      aria-pressed={isActive}
      className={`halo-button board-filter-pill toggle-depri-btn ${variantClass} ${isActive ? 'active' : ''} ${className}`.trim()}
      onClick={onClick}
      title={title}
    >
      {Boolean(icon) && <span className="board-filter-pill__icon" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
};

export default BoardFilterPill;
