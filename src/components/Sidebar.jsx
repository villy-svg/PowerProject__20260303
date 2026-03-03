import React from 'react';
import './Sidebar.css';
import powerLogo from '../assets/logo.svg';
import { VERTICAL_LIST } from '../constants/verticals';

/**
 * Sidebar Component
 * Multi-Vertical Update: Refactored to support the 'assignedVerticals' array.
 */
const Sidebar = ({ isOpen, onClose, activeVertical, setActiveVertical, user, permissions = {} }) => {
  
  // Identify if we are in the "Credential Loading" phase
  const isHydrating = !permissions || Object.keys(permissions).length === 0 || !permissions.scope;

  /**
   * NAVIGATION FILTERING LOGIC
   * Refactored: Uses .includes() to support multiple assigned verticals.
   */
  const filteredVerticals = VERTICAL_LIST.filter(vertical => {
    // Check if the current vertical ID exists within the user's assigned array
    const isExplicitlyAssigned = user?.assignedVerticals?.includes(vertical.id);

    // If still loading credentials, only show what is explicitly assigned to the user
    if (isHydrating) {
      return isExplicitlyAssigned;
    }

    // Global scope (Master Admin/Viewer) sees all verticals
    if (permissions.scope === 'global') {
      return true;
    }

    // Default: Show any vertical included in the assigned array
    return isExplicitlyAssigned;
  });

  const canSeeConfig = permissions?.canAccessConfig;

  const handleDashboardNavigate = () => {
    setActiveVertical(null);
  };

  const handleConfigNavigate = () => {
    if (canSeeConfig) setActiveVertical('configuration');
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-content-wrapper">
        
        <div className="sidebar-top-section">
          <div className="sidebar-header">
            <button className="sidebar-logo-btn" onClick={onClose}>
              <img src={powerLogo} alt="PowerProject Logo" className="logo-svg" />
            </button>
          </div>

          <nav className="sidebar-nav">
            <ul>
              <li 
                className={activeVertical === null ? 'active' : ''} 
                onClick={handleDashboardNavigate}
              >
                Dashboard
              </li>
              
              <hr className="nav-divider" />

              {/* Multi-Vertical Render Logic */}
              {isHydrating ? (
                filteredVerticals.map((v) => (
                  <li key={v.id} className="nav-loading-pulse">{v.label}</li>
                ))
              ) : filteredVerticals.length > 0 ? (
                filteredVerticals.map((vertical) => (
                  <li 
                    key={vertical.id} 
                    className={activeVertical === vertical.id ? 'active' : ''} 
                    onClick={() => setActiveVertical(vertical.id)}
                  >
                    {vertical.label}
                  </li>
                ))
              ) : (
                <li className="nav-empty-state">No Access</li>
              )}
            </ul>
          </nav>
        </div>

        <div className="sidebar-bottom-section">
          <nav className="sidebar-nav">
            <ul>
              {canSeeConfig && (
                <>
                  <hr className="nav-divider" />
                  <li 
                    className={activeVertical === 'configuration' ? 'active' : ''} 
                    onClick={handleConfigNavigate}
                  >
                    Configuration
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;