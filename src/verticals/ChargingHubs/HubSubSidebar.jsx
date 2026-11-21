import React from 'react';
import { HUB_NAV_ITEMS } from '../../constants/verticalFeatures';
import { IconLock } from '../../components/ui/Icons';

/**
 * HubSubSidebar
 *
 * Vertical-specific sidebar navigation for Charging Hubs.
 * Driven by HUB_NAV_ITEMS and shared .sub-sidebar-nav-* styles in VerticalWorkspace.css
 * so locked features (Daily Task Board / Templates) stay disabled consistently across
 * Desktop, Mobile, and ContentRouter with zero inline styles.
 */
const HubSubSidebar = ({
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
      <nav className="sub-sidebar-nav-list" aria-label="Charging Hubs navigation">
        {HUB_NAV_ITEMS.map(({ id, label, permissionKey, locked, buttonId }) => {
          if (!permissions?.[permissionKey]) return null;

          const isLocked = Boolean(locked);
          // Treat root 'CHARGING_HUBS' as active for Hubs Task Board so initial vertical entry highlights correctly
          const isActive = !isLocked && (
            activeVertical === id ||
            (id === 'hub_tasks' && activeVertical === 'CHARGING_HUBS')
          );

          return (
            <button
              key={id}
              id={buttonId}
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

export default HubSubSidebar;
