import React from 'react';
import { useScrollDirection } from '../hooks/useScrollDirection';
import './BottomNav.css';

const IconBase = ({ children, size = 20, strokeWidth = 2, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth={strokeWidth} 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={`nav-icon ${className}`}
  >
    {children}
  </svg>
);

const HomeIcon = () => (
  <IconBase>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </IconBase>
);

const HubsIcon = () => (
  <IconBase>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </IconBase>
);

const EmployeesIcon = () => (
  <IconBase>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </IconBase>
);

const ClientsIcon = () => (
  <IconBase>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </IconBase>
);

const MenuIcon = () => (
  <IconBase>
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </IconBase>
);

/**
 * BottomNav Component
 * Provides "Seamless" mobile navigation tray (<= 768px).
 * Features "Chrome-style" hide-on-scroll behavior.
 */
const BottomNav = ({ activeVertical, setActiveVertical, onMenuClick, verticals = {}, showOverlay = false, onCloseOverlay = null }) => {
  const isScrollVisible = useScrollDirection(10, 100);
  
  // If we are in a vertical, BottomNav is hidden UNLESS the overlay is forced open
  const inVertical = activeVertical !== null;
  const forceShow = showOverlay;
  const isEffectivelyVisible = forceShow || (!inVertical && isScrollVisible);

  const navItems = [
    { id: null, label: 'Dashboard', Icon: HomeIcon },
    { id: verticals.CHARGING_HUBS?.id || 'CHARGING_HUBS', label: 'Hubs', Icon: HubsIcon },
    { id: verticals.EMPLOYEES?.id || 'EMPLOYEES', label: 'Team', Icon: EmployeesIcon },
    { id: verticals.CLIENTS?.id || 'CLIENTS', label: 'Clients', Icon: ClientsIcon },
  ];

  return (
    <>
      {showOverlay && <div className="bottom-nav-backdrop" onClick={onCloseOverlay} />}
      <nav className={`bottom-nav ${!isEffectivelyVisible ? 'bottom-nav-hidden' : ''} ${showOverlay ? 'overlay-mode' : ''}`}>
        <div className="bottom-nav-container">
          {navItems.map((item) => {
            const isActive = activeVertical === item.id;
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
                  <item.Icon />
                </div>
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}
          
          <button className="nav-item menu-trigger" onClick={() => {
            onMenuClick();
            if (onCloseOverlay) onCloseOverlay();
          }}>
            <div className="icon-wrapper">
              <MenuIcon />
            </div>
            <span className="nav-label">More</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
