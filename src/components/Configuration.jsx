import React from 'react';
import './Configuration.css';

/**
 * Configuration Component
 * Provides an interface for system-wide settings and data management.
 * Updated: Added Access Control panel for Master Admins to manage role CRUD.
 */
const Configuration = ({ tasks, setTasks, user = {}, setActiveVertical }) => {
  
  // PERMISSION CHECK: Restricted global actions
  const isMasterAdmin = user?.roleId === 'master_admin';

  const handleClearAllTasks = () => {
    if (!isMasterAdmin) return;

    const confirmed = window.confirm(
      "CRITICAL: This will permanently delete ALL tasks across ALL verticals. Proceed?"
    );
    
    if (confirmed) {
      setTasks([]);
    }
  };

  const totalTasks = (tasks || []).length;

  return (
    <div className="configuration-view">
      <header className="config-header">
        <h2>System Configuration</h2>
        <p>Manage global settings and application data.</p>
      </header>

      <div className="config-grid">
        
        {/* PHASE 3: Access Control Section - Master Admin Only */}
        {isMasterAdmin && (
          <section className="config-section highlight-border">
            <div className="section-icon">🔐</div>
            <div className="section-content">
              <h3>Access Control</h3>
              <p>Define Create, Read, Update, and Delete capabilities for each role.</p>
              
              <div className="config-actions">
                <button 
                  className="btn-primary" 
                  onClick={() => setActiveVertical('role_management')}
                >
                  Manage Role Permissions
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Data Management Section - Restricted to Master Admin */}
        {isMasterAdmin ? (
          <section className="config-section">
            <div className="section-icon">💾</div>
            <div className="section-content">
              <h3>Data Management</h3>
              <p>Current system load: <strong>{totalTasks}</strong> total tasks.</p>
              
              <div className="config-actions">
                <button 
                  className="btn-danger" 
                  onClick={handleClearAllTasks}
                  disabled={totalTasks === 0}
                >
                  Clear All Task Data
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="config-section locked">
            <div className="section-icon">🔒</div>
            <div className="section-content">
              <h3>Data Management</h3>
              <p>Global data management is restricted to the <strong>Master Admin</strong>.</p>
              <div className="config-info-tag">Access Denied</div>
            </div>
          </section>
        )}

        {/* User Preferences Placeholder */}
        <section className="config-section">
          <div className="section-icon">⚙️</div>
          <div className="section-content">
            <h3>Display Preferences</h3>
            <p>Customize how PowerProject looks and feels on your device.</p>
            <div className="config-info-tag">Theme is managed via the header toggle</div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Configuration;