import React, { useState } from 'react';
import { devSanitizeDump } from '../utils/devSanitizer';
import './SandboxManagerModal.css';

const SandboxManagerModal = ({ isOpen, onClose }) => {
  const [pastedJson, setPastedJson] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });

  if (!isOpen) return null;

  const handleImport = () => {
    if (!pastedJson.trim()) {
      setStatus({ type: 'error', message: 'Please paste a JSON session dump first.' });
      return;
    }

    try {
      // 1. Sanitize dump through our secure anonymization utility
      const sanitized = devSanitizeDump(pastedJson);

      if (!sanitized || !sanitized.userProfile) {
        throw new Error('Missing core user profile data in the session dump.');
      }

      // 2. Commit sanitized payload to local storage bypass caches
      localStorage.setItem('power_project_user', JSON.stringify(sanitized.userProfile));
      
      if (sanitized.tasks) {
        localStorage.setItem('powerpod_tasks_v5', JSON.stringify(sanitized.tasks));
      }
      
      if (sanitized.permissions) {
        localStorage.setItem('power_project_permissions', JSON.stringify(sanitized.permissions));
      }

      setStatus({ 
        type: 'success', 
        message: 'Production dump securely anonymized and imported! Reloading sandbox...' 
      });

      // 3. Auto-reload to apply mock variables
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error('[SandboxManager] Import failed:', err);
      setStatus({ 
        type: 'error', 
        message: err.message || 'Failed to parse session dump. Ensure it is a valid JSON object.' 
      });
    }
  };

  const handleClearCache = () => {
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

    setStatus({ 
      type: 'success', 
      message: 'Simulated caches cleared successfully! Reconnecting live...' 
    });

    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  return (
    <div className="sandbox-modal-overlay">
      <div className="sandbox-modal-card">
        <header className="sandbox-modal-header">
          <h2>⚠️ DEVELOPMENT SANDBOX MANAGER</h2>
          <button className="sandbox-close-btn" onClick={onClose}>&times;</button>
        </header>

        <main className="sandbox-modal-body">
          {/* Warning Banner (Risk 2 Mitigation) */}
          <div className="sandbox-safety-notice">
            <h4 className="notice-title">DATABASE INTEGRITY & SAFETY NOTICE</h4>
            <p>
              Your local workspace is currently operating in <strong>Bypass Sandbox Mode</strong>. 
              All reads and writes are directed to local browser memory instead of the live database.
            </p>
            <div className="notice-alert">
              <strong>WARNING:</strong> Supabase Row Level Security (RLS) policies, foreign constraints, 
              and database-level trigger logic are completely bypassed. To verify true database security 
              and API integrity, you must disable the bypass in <code>.env</code> and verify your code 
              against the <strong>Staging DB</strong> environment.
            </div>
          </div>

          {/* Pasting area */}
          <div className="import-dump-section">
            <h3>PASTE LIVE SESSION DUMP</h3>
            <p className="field-desc">
              Paste the JSON session dump extracted from your online admin console. The sandbox will automatically
              anonymize all personal emails, employee names, phone numbers, and keys before caching.
            </p>
            <textarea
              className="dump-textarea"
              placeholder="Paste JSON dump here..."
              value={pastedJson}
              onChange={(e) => setPastedJson(e.target.value)}
            />
          </div>

          {/* Status Message */}
          {status.message && (
            <div className={`sandbox-status-message ${status.type}`}>
              {status.message}
            </div>
          )}
        </main>
        <footer className="sandbox-modal-footer">
          <button className="halo-button clear-cache-btn" onClick={handleClearCache}>
            🔌 RECONNECT LIVE
          </button>
          <div className="footer-right-actions">
            <button className="halo-button cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button className="halo-button import-btn" onClick={handleImport}>
              ✨ ANONYMIZE & IMPORT
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default SandboxManagerModal;
