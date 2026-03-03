import React from 'react';
import './RoleSwitcher.css';

const RoleSwitcher = ({ currentUser, onRoleChange }) => {
  const roles = [
    { id: 'master_admin', label: 'Master Admin', icon: '👑' },
    { id: 'vertical_admin', label: 'Vertical Admin', icon: '🏢' },
    { id: 'master_viewer', label: 'Master Viewer', icon: '👁️' }
  ];

  return (
    <div className="role-switcher-container">
      <select 
        value={currentUser.roleId} 
        onChange={(e) => onRoleChange(e.target.value)}
        className="role-select-dropdown"
      >
        {roles.map(role => (
          <option key={role.id} value={role.id}>
            {role.icon} {role.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default RoleSwitcher;