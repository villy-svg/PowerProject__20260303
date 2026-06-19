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
} from '../ui/Icons';
import './BottomNav.css'; // Shared BottomNav styles — same visual system as MobileBottomNav
import { useAppNavigation } from '../../app/contexts/AppNavigationContext';

/**
 * Section jump targets — must match the `id` anchors in Configuration.jsx.
 * The Dashboard tab is special: it navigates away from config entirely.
 */
const CONFIG_TABS = [
  { id: 'switch',  label: 'Switch',    Icon: IconHome,     section: null },
  { id: 'hubs',    label: 'Hubs',      Icon: IconHubs,     section: 'config-section-hubs' },
  { id: 'team',    label: 'Team',      Icon: IconPeople,   section: 'config-section-team' },
  { id: 'clients', label: 'Clients',   Icon: IconDatabase, section: 'config-section-clients' },
  { id: 'general', label: 'General',   Icon: IconSettings, section: 'config-section-general' },
];

const ConfigBottomNav = ({ 
  activeSection, 
  setActiveSection, 
  permissions = {}, 
  user = {}, 
  verticals = {} 
}) => {
  const { showBottomNavOverlay, setShowBottomNavOverlay } = useAppNavigation();

  // Filter tabs based on vertical permissions
  const filteredTabs = CONFIG_TABS.filter(tab => {
    if (tab.id === 'switch') return true;
    if (tab.id === 'general') return true;
    if (tab.id === 'hubs') {
      return permissions.scope === 'global' || user.assignedVerticals?.includes(verticals.CHARGING_HUBS?.id);
    }
    if (tab.id === 'team') {
      return permissions.scope === 'global' || user.assignedVerticals?.includes(verticals.EMPLOYEES?.id);
    }
    if (tab.id === 'clients') {
      return permissions.scope === 'global' || user.assignedVerticals?.includes(verticals.CLIENTS?.id);
    }
    return false;
  });

  const handleTabClick = (tab) => {
    if (tab.id === 'switch') {
      setShowBottomNavOverlay(prev => !prev);
      return;
    }
    if (setActiveSection) {
      setActiveSection(tab.id);
    }
  };

  return (
    <nav className="bottom-nav config-bottom-nav" aria-label="Configuration Sections">
      <div className="bottom-nav-container">
        {filteredTabs.map((tab) => {
          const isActive = tab.id === 'switch'
            ? showBottomNavOverlay
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
