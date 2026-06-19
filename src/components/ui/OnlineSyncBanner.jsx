import React, { useState, useEffect } from 'react';
import './OnlineSyncBanner.css';

const OnlineSyncBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const isBypassActive = import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true';

  useEffect(() => {
    // Only register online listener if in dev mode with offline bypass capability
    if (!isBypassActive) return;

    const handleOnlineStatusChange = () => {
      // Check if we have cached offline bypass files in localStorage
      const hasOfflineCache = localStorage.getItem('power_project_user') || 
                              localStorage.getItem('powerpod_tasks_v5') ||
                              localStorage.getItem('powerpod_employee_rules_offline');
      
      if (navigator.onLine && hasOfflineCache) {
        setIsVisible(true);
      }
    };

    window.addEventListener('online', handleOnlineStatusChange);
    
    // Initial check in case internet connected immediately after initialization
    handleOnlineStatusChange();

    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
    };
  }, [isBypassActive]);

  if (!isVisible) return null;

  const handleReconnect = () => {
    // Purge simulated local storage bypass targets
    localStorage.removeItem('power_project_user');
    localStorage.removeItem('powerpod_tasks_v5');
    localStorage.removeItem('power_project_permissions');
    localStorage.removeItem('power_project_cache_verticals');
    localStorage.removeItem('power_project_permissions_verticalCaps');
    
    // Purge offline rules caching keys
    localStorage.removeItem('powerpod_rule_categories_offline');
    localStorage.removeItem('powerpod_rule_sub_categories_offline');
    localStorage.removeItem('powerpod_employee_rules_offline');

    setIsVisible(false);
    
    // Hard reload to connect to authentic auth services
    window.location.reload();
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  return (
    <div className="online-sync-banner-overlay">
      <div className="online-sync-banner">
        <div className="sync-banner-left">
          <span className="online-indicator-dot"></span>
          <p className="sync-banner-text">
            <strong>System Back Online!</strong> Reconnect and sync your workspace with the live cloud database?
          </p>
        </div>
        <div className="sync-banner-right">
          <button className="halo-button dismiss-banner-btn" onClick={handleDismiss}>
            Keep Offline
          </button>
          <button className="halo-button reconnect-sync-btn" onClick={handleReconnect}>
            🔌 Reconnect & Sync
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnlineSyncBanner;
