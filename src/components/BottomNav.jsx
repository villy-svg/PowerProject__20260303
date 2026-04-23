import React from 'react';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { 
  IconHome, 
  IconMenu, 
  IconHubs, 
  IconPeople, 
  IconDatabase 
} from './Icons';
import './BottomNav.css';

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
    { id: null, label: 'Dashboard', Icon: IconHome },
    { id: verticals.CHARGING_HUBS?.id || 'CHARGING_HUBS', label: 'Hubs', Icon: IconHubs },
    { id: verticals.EMPLOYEES?.id || 'EMPLOYEES', label: 'Team', Icon: IconPeople },
    { id: verticals.CLIENTS?.id || 'CLIENTS', label: 'Clients', Icon: IconDatabase },
  ];

  return (
    <>
      {showOverlay && <div className="bottom-nav-backdrop" onClick={onCloseOverlay} />}
      <nav className={`bottom-nav ${(!isEffectivelyVisible && !showOverlay) ? 'bottom-nav-hidden' : ''} ${showOverlay ? 'overlay-mode' : ''}`}>
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
                  <item.Icon size={24} strokeWidth={isActive ? 2.2 : 1.8} />
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
              <IconMenu size={24} />
            </div>
            <span className="nav-label">More</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
