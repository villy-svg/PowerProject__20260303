import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { VERTICAL_LIST } from '../constants/verticals';
import { ROLE_LEVELS, ROLE_SCOPES, DEFAULT_ROLE_PERMISSIONS } from '../constants/roles';
import './UserManagement.css';

const UserManagement = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [status, setStatus] = useState({ type: '', text: '' });

  // Separate state for role components during editing
  const [editRoleScope, setEditRoleScope] = useState('vertical');
  const [editRoleLevel, setEditRoleLevel] = useState('viewer');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching users:", error.message);
      setStatus({ type: 'error', text: 'Failed to load users.' });
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const handleOpenEdit = (user) => {
    const [scope, level] = user.role_id?.split('_') || ['vertical', 'viewer'];
    setEditRoleScope(scope);
    setEditRoleLevel(level);
    setEditingUser({ ...user });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setLoading(true);
    setStatus({ type: '', text: '' });

    const newRoleId = `${editRoleScope}_${editRoleLevel}`;
    
    // If scope is master, they should generally have all verticals (though UI might track specific ones)
    // For now, we keep the assigned_verticals as is unless they were empty
    const finalVerticals = editRoleScope === 'master' 
      ? VERTICAL_LIST.map(v => v.id) 
      : editingUser.assigned_verticals;

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        role_id: newRoleId,
        assigned_verticals: finalVerticals
      })
      .eq('id', editingUser.id)
      .select();

    if (error) {
      setStatus({ type: 'error', text: `Sync Error: ${error.message}` });
      setLoading(false);
    } else {
      setStatus({ type: 'success', text: 'User permissions synchronized with cloud!' });
      setEditingUser(null);
      await fetchUsers();
    }
  };

  const toggleVertical = (vId) => {
    setEditingUser(prev => {
      const verticals = [...(prev.assigned_verticals || [])];
      if (verticals.includes(vId)) {
        return { ...prev, assigned_verticals: verticals.filter(id => id !== vId) };
      } else {
        return { ...prev, assigned_verticals: [...verticals, vId] };
      }
    });
  };

  if (loading && users.length === 0) return <div className="user-mgmt-loading">Loading Users...</div>;

  return (
    <div className="user-management-container">
      <header className="user-mgmt-header">
        <h2>User Management</h2>
        <p>Manage application users, their roles, and vertical access levels.</p>
      </header>

      {status.text && (
        <div className={`status-banner ${status.type}`}>
          {status.text}
          <button onClick={() => setStatus({ type: '', text: '' })}>×</button>
        </div>
      )}

      <div className="user-list-wrapper">
        <table className="user-table">
          <thead>
            <tr>
              <th>Name / Email</th>
              <th>Role</th>
              <th>Vertical Access</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="user-identity">
                    <span className="user-name-cell">{u.name}</span>
                    <span className="user-email-cell">{u.email}</span>
                  </div>
                </td>
                <td>
                  <span className={`role-badge ${u.role_id}`}>
                    {u.role_id?.replace('_', ' ')}
                  </span>
                </td>
                <td>
                  <div className="vertical-tags">
                    {u.role_id?.startsWith('master') ? (
                      <span className="v-tag master">All Verticals (Master)</span>
                    ) : (
                      u.assigned_verticals?.length > 0 ? (
                        u.assigned_verticals.map(vId => (
                          <span key={vId} className="v-tag">{vId}</span>
                        ))
                      ) : (
                        <span className="v-tag locked">No Access</span>
                      )
                    )}
                  </div>
                </td>
                <td>
                  <button className="halo-button edit-user-btn" onClick={() => handleOpenEdit(u)}>
                    Edit Permissions
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div className="edit-modal-overlay">
          <div className="edit-modal user-role-modal">
            <header className="modal-header">
              <h3>Configure Access: {editingUser.name}</h3>
              <button className="close-modal" onClick={() => setEditingUser(null)}>&times;</button>
            </header>
            
            <form onSubmit={handleUpdateUser}>
              <div className="role-config-grid">
                {/* 1. Scope Selection */}
                <div className="form-section">
                  <label className="section-label">1. Select Access Scope</label>
                  <div className="scope-options">
                    {ROLE_SCOPES.map(scope => (
                      <div 
                        key={scope.id} 
                        className={`scope-card ${editRoleScope === scope.id ? 'active' : ''}`}
                        onClick={() => setEditRoleScope(scope.id)}
                      >
                        <div className="radio-circle"></div>
                        <div className="scope-info">
                          <span className="scope-name">{scope.label}</span>
                          <span className="scope-desc">{scope.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Capability Level Selection */}
                <div className="form-section">
                  <label className="section-label">2. Select Capability Level</label>
                  <div className="level-options">
                    {ROLE_LEVELS.map(level => (
                      <div 
                        key={level.id} 
                        className={`level-card ${editRoleLevel === level.id ? 'active' : ''}`}
                        onClick={() => setEditRoleLevel(level.id)}
                      >
                        <div className="radio-circle"></div>
                        <div className="level-info">
                          <span className="level-name">{level.label}</span>
                          <span className="level-desc">{level.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Vertical Selection (Only for Vertical Scope) */}
              {editRoleScope === 'vertical' && (
                <div className="form-section vertical-assignment-section">
                  <label className="section-label">3. Assign Verticals</label>
                  <div className="vertical-selection-grid">
                    {VERTICAL_LIST.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        className={`v-select-btn ${editingUser.assigned_verticals?.includes(v.id) ? 'active' : ''}`}
                        onClick={() => toggleVertical(v.id)}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                  {(!editingUser.assigned_verticals || editingUser.assigned_verticals.length === 0) && (
                    <p className="selection-warning">⚠️ No verticals assigned. User will have no workspace access.</p>
                  )}
                </div>
              )}

              {editRoleScope === 'master' && (
                <div className="master-scope-notice">
                  <p>✨ <strong>Master Scope</strong> grants automatic read/write access to all current and future verticals.</p>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="halo-button cancel-btn" onClick={() => setEditingUser(null)}>Cancel</button>
                <button type="submit" className="halo-button save-btn" disabled={loading}>
                  {loading ? 'Saving...' : 'Sync Permissions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
