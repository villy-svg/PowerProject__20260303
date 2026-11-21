import React from 'react';
import { EMPLOYEE_NAV_ITEMS } from '../../constants/verticalFeatures';
import { IconLock } from '../../components/ui/Icons';

/**
 * EmployeeSubSidebar
 *
 * Vertical-specific sidebar navigation for the Employees vertical.
 * Renders ordered board links from EMPLOYEE_NAV_ITEMS with RBAC guards,
 * using shared .sub-sidebar-nav-* styles in VerticalWorkspace.css.
 */
const EmployeeSubSidebar = ({
  permissions = {},
  activeVertical,
  setActiveVertical,
  hideNavigation,
}) => {
  if (hideNavigation) {
    return <div className="sub-sidebar-body" />;
  }

  return (
    <div className="sub-sidebar-body">
      <nav className="sub-sidebar-nav-list" aria-label="Employees navigation">
        {EMPLOYEE_NAV_ITEMS.map(({ id, label, permissionKey, requireTruthy, locked }) => {
          const isAllowed = requireTruthy
            ? Boolean(permissions?.[permissionKey])
            : permissions?.[permissionKey] !== false;

          if (!isAllowed) return null;

          const isLocked = Boolean(locked);
          const isActive = !isLocked && activeVertical === id;

          return (
            <button
              key={id}
              type="button"
              disabled={isLocked}
              aria-disabled={isLocked}
              title={isLocked ? 'Coming Soon / Locked' : undefined}
              className={`halo-button sub-sidebar-nav-btn ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
              onClick={() => !isLocked && setActiveVertical(id)}
            >
              <span>{label}</span>
              {isLocked && <IconLock className="sub-sidebar-nav-lock-icon" size={14} />}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default EmployeeSubSidebar;
