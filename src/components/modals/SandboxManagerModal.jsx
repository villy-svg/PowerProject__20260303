import React, { useState } from 'react';
import { devSanitizeDump } from '../../utils/devSanitizer';
import { IconWarning } from '../ui/Icons';
import { DEFAULT_ROLE_PERMISSIONS } from '../../constants/roles';
import './SandboxManagerModal.css';

const ROLES = [
  { id: 'master_admin', label: 'Master Admin (Global, Full CRUD)' },
  { id: 'master_editor', label: 'Master Editor (Global, Write but no Delete)' },
  { id: 'master_contributor', label: 'Master Contributor (Global, Create but no Update)' },
  { id: 'master_viewer', label: 'Master Viewer (Global, Read-Only)' },
  { id: 'vertical_admin', label: 'Vertical Admin (Assigned Verticals, Full CRUD)' },
  { id: 'vertical_editor', label: 'Vertical Editor (Assigned Verticals, Write but no Delete)' },
  { id: 'vertical_contributor', label: 'Vertical Contributor (Assigned Verticals, Create but no Update)' },
  { id: 'vertical_viewer', label: 'Vertical Viewer (Assigned Verticals, Read-Only)' }
];

const VERTICAL_OPTIONS = [
  { id: 'CHARGING_HUBS', label: 'Hubs' },
  { id: 'CLIENTS', label: 'Clients' },
  { id: 'EMPLOYEES', label: 'Employees' },
  { id: 'DATA_MANAGER', label: 'Data' },
  { id: 'PARTNERS', label: 'Partners' },
  { id: 'VENDORS', label: 'Vendors' }
];

const SandboxManagerModal = ({ isOpen, onClose }) => {
  const [pastedJson, setPastedJson] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });

  // Load initial simulated user profile
  const [simulatedUser, setSimulatedUser] = useState(() => {
    const cached = localStorage.getItem('power_project_user');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.roleId) return parsed;
      } catch (e) {
        console.error('Error parsing simulated user from local storage:', e);
      }
    }
    // Fallback template
    return {
      id: 'dev-bypass-user-id',
      name: 'Dev Admin (Offline)',
      email: 'dev@powerpod.in',
      roleId: 'master_admin',
      role: 'master_admin',
      isActive: true,
      seniority: 10,
      employeeId: 'dev-bypass-employee-id',
      assignedVerticals: ['CHARGING_HUBS', 'EMPLOYEES', 'CLIENTS', 'DATA_MANAGER'],
      verticalPermissions: {
        CHARGING_HUBS: { level: 'admin', features: {} },
        EMPLOYEES: { level: 'admin', features: {} },
        CLIENTS: { level: 'admin', features: {} },
        DATA_MANAGER: { level: 'admin', features: {} }
      },
      baseCapabilities: DEFAULT_ROLE_PERMISSIONS.master_admin
    };
  });

  if (!isOpen) return null;

  const handleRoleChange = (roleId) => {
    const basePerms = DEFAULT_ROLE_PERMISSIONS[roleId] || DEFAULT_ROLE_PERMISSIONS.master_viewer;
    const isMaster = roleId.startsWith('master');
    
    // Auto-select all verticals for master scope by default, or keep current for vertical scope
    const assignedVerticals = isMaster 
      ? VERTICAL_OPTIONS.map(v => v.id) 
      : simulatedUser.assignedVerticals.filter(v => v !== 'PARTNERS' && v !== 'VENDORS'); // default subset for vertical

    const level = roleId.endsWith('admin') ? 'admin' 
                : roleId.endsWith('editor') ? 'editor' 
                : roleId.endsWith('contributor') ? 'contributor' 
                : 'viewer';

    const verticalPermissions = assignedVerticals.reduce((acc, vId) => {
      acc[vId] = { level, features: {} };
      return acc;
    }, {});

    const seniority = roleId.includes('admin') ? 10 
                    : roleId.includes('editor') ? 7 
                    : roleId.includes('contributor') ? 4 
                    : 2;

    setSimulatedUser(prev => ({
      ...prev,
      roleId,
      role: roleId,
      name: `Dev ${roleId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} (Offline)`,
      assignedVerticals,
      verticalPermissions,
      baseCapabilities: basePerms,
      seniority
    }));
  };

  const handleVerticalToggle = (verticalId) => {
    const isAssigned = simulatedUser.assignedVerticals.includes(verticalId);
    let newAssigned;
    if (isAssigned) {
      newAssigned = simulatedUser.assignedVerticals.filter(id => id !== verticalId);
    } else {
      newAssigned = [...simulatedUser.assignedVerticals, verticalId];
    }

    const roleId = simulatedUser.roleId;
    const level = roleId.endsWith('admin') ? 'admin' 
                : roleId.endsWith('editor') ? 'editor' 
                : roleId.endsWith('contributor') ? 'contributor' 
                : 'viewer';

    const verticalPermissions = newAssigned.reduce((acc, vId) => {
      acc[vId] = { level, features: {} };
      return acc;
    }, {});

    setSimulatedUser(prev => ({
      ...prev,
      assignedVerticals: newAssigned,
      verticalPermissions
    }));
  };

  const handleSaveSimulatedRole = () => {
    try {
      localStorage.setItem('power_project_user', JSON.stringify(simulatedUser));
      setStatus({
        type: 'success',
        message: 'Offline simulated role updated successfully! Reloading...'
      });
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      setStatus({
        type: 'error',
        message: 'Failed to update simulated role.'
      });
    }
  };

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

  const isVerticalScope = simulatedUser.roleId && simulatedUser.roleId.startsWith('vertical');

  return (
    <div className="sandbox-modal-overlay">
      <div className="sandbox-modal-card">
        <header className="sandbox-modal-header u-flex-center-gap">
          <IconWarning size={20} style={{ color: 'var(--brand-yellow)' }} />
          <h2 className="u-m-0">DEVELOPMENT SANDBOX MANAGER</h2>
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

          {/* SIMULATE ROLE IN OFFLINE MODE */}
          <div className="role-simulator-section">
            <h3>SIMULATE OFFLINE ROLE</h3>
            <p className="field-desc">
              Select a role and toggle assigned verticals to simulate permission levels locally in offline mode.
            </p>
            
            <div className="simulator-controls">
              <div className="form-group">
                <label className="field-label">Active Role</label>
                <select 
                  className="role-select"
                  value={simulatedUser.roleId} 
                  onChange={(e) => handleRoleChange(e.target.value)}
                >
                  {ROLES.map(role => (
                    <option key={role.id} value={role.id}>{role.label}</option>
                  ))}
                </select>
              </div>

              {isVerticalScope && (
                <div className="form-group">
                  <label className="field-label">Assigned Verticals</label>
                  <div className="verticals-grid">
                    {VERTICAL_OPTIONS.map(v => {
                      const isChecked = simulatedUser.assignedVerticals.includes(v.id);
                      return (
                        <label key={v.id} className={`vertical-checkbox-card ${isChecked ? 'checked' : ''}`}>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => handleVerticalToggle(v.id)}
                          />
                          <span>{v.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <button className="halo-button save-role-btn" onClick={handleSaveSimulatedRole}>
                💾 APPLY ROLE SIMULATION
              </button>
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
