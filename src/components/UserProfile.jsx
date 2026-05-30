import React, { useState, useRef, useEffect } from 'react';
import { VERTICAL_LIST } from '../constants/verticals';
import { ROLE_LIST } from '../constants/roles';
import CustomSelect from './CustomSelect';
import './UserProfile.css';

const UserProfile = ({ 
  user, 
  onRoleChange, 
  onConfigClick, 
  onLogout,
  realUser,
  impersonatedUser,
  impersonationUsers,
  onImpersonate
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roles = ROLE_LIST;

  const handleRoleSelect = (roleId) => {
    // If switching to a vertical role, we default to the first vertical if none assigned
    const defaultVertical = (roleId.includes('vertical') && !user.assignedVertical) 
      ? VERTICAL_LIST[0].id 
      : user.assignedVertical;

    onRoleChange(roleId, defaultVertical);
  };

  const handleVerticalSelect = (vId) => {
    onRoleChange(user.roleId, vId);
  };

  const displayName = user?.name || "Guest User";
  // Updated initials logic to handle single names or empty strings safely
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const isVerticalRole = user?.roleId === 'vertical_admin' || user?.roleId === 'vertical_viewer';

  return (
    <div className="user-profile-container" ref={dropdownRef}>
      <button className="user-profile-toggle" onClick={() => setIsOpen(!isOpen)}>
        {/* WRAPPER FOR TEXT: This div is styled in CSS to stack vertically */}
        <div className="user-info-text">
          <span className="user-name">{displayName}</span>
          <span className="user-role">{user?.role}</span>
        </div>
        <div className="user-avatar">{initials}</div>
      </button>

      {isOpen && (
        <div className="user-dropdown-menu">
          <div className="dropdown-header">Profile Details</div>
          <div className="dropdown-item static">
            <span className="role-label">{user?.roleId?.replace('_', ' ').toUpperCase()}</span>
          </div>
          
          {realUser?.roleId === 'master_admin' && (
            <>
              <div className="dropdown-divider" />
              <div className="dropdown-header impersonation-section-title">Impersonation Simulator</div>
              <div className="dropdown-impersonation-container">
                {impersonatedUser ? (
                  <div className="impersonation-menu-active">
                    <span className="impersonation-menu-label">
                      Viewing: <strong>{impersonatedUser.name}</strong>
                    </span>
                    <button 
                      className="halo-button impersonation-menu-stop-btn" 
                      onClick={() => { onImpersonate(null); setIsOpen(false); }}
                    >
                      Stop Simulation
                    </button>
                  </div>
                ) : (
                  <CustomSelect
                    id="impersonation-select-menu"
                    placeholder="Simulate User..."
                    options={impersonationUsers?.map(u => ({
                      value: u.id,
                      label: `${u.name} (${u.role_id})`
                    })) || []}
                    onChange={(val) => { onImpersonate(val); setIsOpen(false); }}
                  />
                )}
              </div>
            </>
          )}

          <div className="dropdown-divider" />
          
          <button className="dropdown-item config-link" onClick={() => { onConfigClick(); setIsOpen(false); }}>
            Configuration
          </button>
          
          <button className="dropdown-item logout-button" onClick={() => { onLogout(); setIsOpen(false); }}>
            Log Out
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;