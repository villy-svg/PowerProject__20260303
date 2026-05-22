/**
 * ConfigBottomNav.jsx
 *
 * Mobile-only bottom nav bar for the System Configuration page.
 * Provides quick section jumping (Hubs, Team, Clients, General) and
 * a Home/Dashboard button as the first icon — matching the task board tray pattern.
 *
 * Active tab is driven by an IntersectionObserver watching config section anchors,
 * passed down as the `activeSection` prop from Configuration.jsx.
 *
 * DOES NOT INCLUDE:
 * - Desktop rendering (hidden via CSS media query in BottomNav.css)
 *
 * Skill compliance:
 * - adaptive-ui-strategy §4 Mobile Interactions, §5 Mobile Layout
 * - ui-design-system §2 Halo Buttons, §14 Mobile Viewport Adaptations
 */
import React from 'react';
import {
  IconHome,
  IconHubs,
  IconPeople,
  IconDatabase,
  IconSettings,
} from './Icons';
import './BottomNav.css'; // Shared BottomNav styles — same visual system as MobileBottomNav
import { useAppNavigation } from '../app/contexts/AppNavigationContext';

/**
 * Section jump targets — must match the `id` anchors in Configuration.jsx.
 * The Dashboard tab is special: it navigates away from config entirely.
 */
const CONFIG_TABS = [
  { id: 'home',    label: 'Dashboard', Icon: IconHome,     section: null },
  { id: 'hubs',    label: 'Hubs',      Icon: IconHubs,     section: 'config-section-hubs' },
  { id: 'team',    label: 'Team',      Icon: IconPeople,   section: 'config-section-team' },
  { id: 'clients', label: 'Clients',   Icon: IconDatabase, section: 'config-section-clients' },
  { id: 'general', label: 'General',   Icon: IconSettings, section: 'config-section-general' },
];

const ConfigBottomNav = ({ activeSection }) => {
  const { setActiveVertical } = useAppNavigation();

  const handleTabClick = (tab) => {
    if (tab.id === 'home') {
      // Navigate away from Configuration to the Dashboard
      setActiveVertical(null);
      return;
    }
    // Smooth-scroll to the section anchor within the config page
    const el = document.getElementById(tab.section);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav className="bottom-nav config-bottom-nav" aria-label="Configuration Sections">
      <div className="bottom-nav-container">
        {CONFIG_TABS.map((tab) => {
          const isActive = tab.id === 'home'
            ? false // Home tab never shows as "active" — it navigates away
            : activeSection === tab.id;

          return (
            <button
              key={tab.id}
              id={`config-nav-${tab.id}`}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handleTabClick(tab)}
              aria-label={tab.label}
            >
              <div className="icon-wrapper">
                <tab.Icon size={24} strokeWidth={isActive ? 2.2 : 1.8} />
              </div>
              <span className="nav-label">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default ConfigBottomNav;
