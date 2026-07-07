/**
 * MobileBottomNav.jsx
 *
 * Mobile-only bottom persistent tab bar. Features:
 * - Direct primary switching between Dashboard, Hubs, Teams, and Clients.
 * - Backdrop blurring and tap-to-dismiss overlay wrapper.
 * - Scroll-aware sticky hiding/showing (hides on scroll down, reveals on scroll up).
 *
 * DOES NOT INCLUDE:
 * - Desktop inline navigation components.
 *
 * Skill compliance:
 * - adaptive-ui-strategy §4 Mobile Interactions (Touch)
 * - adaptive-ui-strategy §5 Mobile Layout
 */

import React from 'react';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import {
  IconHome,
  IconMenu,
  IconHubs,
  IconPeople,
  IconDatabase,
  IconSearch,
} from '../../components/ui/Icons';
import '../../components/layout/BottomNav.css';

import SearchBar from '../../components/ui/SearchBar';
import { useAppNavigation } from '../contexts/AppNavigationContext';
import { resolveVerticalRootId } from '../../registry/verticalRegistry';

const MobileBottomNav = ({
  activeVertical,
  setActiveVertical,
  onMenuClick,
  verticals = {},
  showOverlay = false,
  onCloseOverlay = null,
  user,
  permissions,
}) => {
  const isScrollVisible = useScrollDirection(10, 100);
  const { searchProps, isSearchOpen, setIsSearchOpen } = useAppNavigation();

  const isDashboard = !activeVertical;
  const forceShow = showOverlay;
  const isEffectivelyVisible = forceShow || isDashboard || isScrollVisible;
  const hasSearch = !searchProps?.hideSearchBar;
  const isBottomNavExpanded = hasSearch && isSearchOpen;

  const isAssigned = (vId) => {
    if (!vId) return true; // Dashboard is always assigned
    return user?.assignedVerticals?.includes(vId) || permissions?.scope === 'global';
  };

  const navItems = [
    { id: null, label: 'Dashboard', Icon: IconHome },
    { id: verticals.CHARGING_HUBS?.id || 'CHARGING_HUBS', label: 'Hubs', Icon: IconHubs },
    { id: verticals.EMPLOYEES?.id || 'EMPLOYEES', label: 'Team', Icon: IconPeople },
    { id: verticals.CLIENTS?.id || 'CLIENTS', label: 'Clients', Icon: IconDatabase },
  ].filter(item => isAssigned(item.id));

  // Phase 3 Architecture: MobileBottomNav is the primary navigation on the dashboard.
  // Inside verticals, it is replaced by the mobile-action-tray (MasterPageHeader).
  // It should only appear inside a vertical if the user taps "Switch" (showOverlay).
  if (!isDashboard && !showOverlay) {
    return null;
  }

  return (
    <>
      {showOverlay && <div className="bottom-nav-backdrop" onClick={onCloseOverlay} />}
      {isSearchOpen && <div className="bottom-nav-backdrop" onClick={() => setIsSearchOpen(false)} />}
      <nav className={`bottom-nav ${(!isEffectivelyVisible && !showOverlay) ? 'bottom-nav-hidden' : ''} ${showOverlay ? 'overlay-mode' : ''} ${isBottomNavExpanded ? 'has-search' : ''}`}>
        {!showOverlay && hasSearch && isSearchOpen && (
          <div className="bottom-nav-search-wrapper">
            <SearchBar
              context={activeVertical ? 'board' : 'dashboard'}
              records={searchProps?.records}
              recordType={searchProps?.recordType || 'Record'}
              onSelect={(record) => {
                if (searchProps?.onSelect) {
                  searchProps.onSelect(record);
                }
                setIsSearchOpen(false);
              }}
            />
          </div>
        )}
        <div className="bottom-nav-container">
          {navItems.map((item) => {
            const rootVerticalId = resolveVerticalRootId(activeVertical, verticals);
            const isActive = rootVerticalId === item.id || activeVertical === item.id;
            return (
              <button
                key={item.label}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveVertical(item.id);
                  if (onCloseOverlay) onCloseOverlay();
                }}
              >
                <div className="icon-wrapper">
                  <item.Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
                </div>
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}

          {hasSearch && (
            <button
              className={`nav-item search-trigger ${isSearchOpen ? 'active' : ''}`}
              onClick={() => {
                setIsSearchOpen(prev => !prev);
                if (onCloseOverlay) onCloseOverlay();
              }}
            >
              <div className="icon-wrapper">
                <IconSearch size={16} />
              </div>
              <span className="nav-label">Search</span>
            </button>
          )}

          <button
            className="nav-item menu-trigger"
            onClick={() => {
              onMenuClick();
              if (onCloseOverlay) onCloseOverlay();
            }}
          >
            <div className="icon-wrapper">
              <IconMenu size={16} />
            </div>
            <span className="nav-label">More</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
