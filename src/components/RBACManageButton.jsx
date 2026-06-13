import React, { useState, useRef, useEffect } from 'react';
import './RBACManageButton.css';

/**
 * RBACManageButton
 *
 * Master-admin-only RBAC shortcut button for management boards.
 * Renders null for any non-master-admin user — fully silent guard.
 *
 * Props:
 *   user             {object}    - Current user object (needs roleId).
 *   setActiveVertical {function} - Navigation function.
 *   label            {string}    - Display label (e.g., "Employees", "Departments").
 *   subItems         {Array}     - Optional: [{label, target}] for bigger boards with sub-boards.
 *                                  When provided, renders a compact dropdown menu.
 *
 * Security: Guard is `user?.roleId === 'master_admin'` (frontend layer).
 * The navigation target `user_management` is also gated in App.jsx's RBAC
 * security validation effect — defence in depth.
 */
const RBACManageButton = ({ user, setActiveVertical, label = 'Access', subItems = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Hard guard: invisible to everyone except master_admin
  if (user?.roleId !== 'master_admin') return null;

  const hasSubItems = subItems.length > 0;

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Simple single button (for sub-boards)
  if (!hasSubItems) {
    return (
      <button
        className="halo-button rbac-manage-btn"
        onClick={() => setActiveVertical('user_management')}
        title={`Configure RBAC access for: ${label}`}
      >
        🔐 {label} Access
      </button>
    );
  }

  // Dropdown group (for bigger boards with sub-boards)
  return (
    <div className="rbac-access-group" ref={dropdownRef}>
      <button
        className="halo-button rbac-manage-btn rbac-manage-btn--group"
        onClick={() => setIsOpen(prev => !prev)}
        title="Configure RBAC access controls"
      >
        🔐 Manage Access
        <span className={`rbac-chevron ${isOpen ? 'rbac-chevron--open' : ''}`}>▾</span>
      </button>

      {isOpen && (
        <div className="rbac-dropdown-menu">
          <p className="rbac-dropdown-header">Configure Access For:</p>
          {subItems.map(item => (
            <button
              key={item.label}
              className="rbac-dropdown-item"
              onClick={() => {
                setIsOpen(false);
                setActiveVertical('user_management');
              }}
              title={`Manage RBAC for: ${item.label}`}
            >
              <span className="rbac-item-icon">🔐</span>
              <span className="rbac-item-label">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RBACManageButton;
