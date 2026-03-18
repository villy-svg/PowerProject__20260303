import React from 'react';
import { ROLE_LIST } from '../constants/roles';
import './UserRoleManagement.css';

/**
 * UserRoleManagement Component
 * Provides a matrix to toggle CRUD capabilities for each role.
 * Only accessible by Master Admin.
 */
const UserRoleManagement = ({ permissions, setPermissions, onBack }) => {

  const handleToggle = (roleId, capability) => {
    const updatedPermissions = {
      ...permissions,
      [roleId]: {
        ...permissions[roleId],
        [capability]: !permissions[roleId][capability]
      }
    };
    setPermissions(updatedPermissions);
  };

  const capabilities = [
    { id: 'canCreate', label: 'Create' },
    { id: 'canRead', label: 'Read' },
    { id: 'canUpdate', label: 'Update' },
    { id: 'canDelete', label: 'Delete' }
  ];

  return (
    <div className="management-view-container">
      <MasterPageHeader
        title="Role Permissions Matrix"
        description="Global overrides for Create, Read, Update, and Delete actions across all system entities."
        leftActions={
          <button className="halo-button back-link-btn" onClick={onBack}>
            ← Back to Configuration
          </button>
        }
      />

      <div className="matrix-container">
        <table className="permissions-table">
          <thead>
            <tr>
              <th>User Role</th>
              {capabilities.map(cap => (
                <th key={cap.id}>{cap.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLE_LIST.map((role) => (
              <tr key={role.id}>
                <td className="role-cell">
                  <span className="role-icon">{role.icon}</span>
                  <div className="role-details">
                    <span className="role-name">{role.label}</span>
                    <span className="role-id-tag">{role.id}</span>
                  </div>
                </td>
                {capabilities.map(cap => (
                  <td key={cap.id} className="checkbox-cell">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={permissions[role.id]?.[cap.id] || false}
                        onChange={() => handleToggle(role.id, cap.id)}
                        disabled={role.id === 'master_admin'} // Safety: Admin cannot lock themselves out
                      />
                      <span className="slider"></span>
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="matrix-footer">
        <p>⚠️ Changes are saved automatically to the system load.</p>
      </div>
    </div>
  );
};

export default UserRoleManagement;