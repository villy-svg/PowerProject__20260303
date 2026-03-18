import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { VERTICAL_LIST } from '../constants/verticals';
import { ROLE_LEVELS, ROLE_SCOPES, DEFAULT_ROLE_PERMISSIONS } from '../constants/roles';
import './UserManagement.css';

const LEVEL_RANKS = { none: 0, viewer: 1, contributor: 2, editor: 3, admin: 4 };

const UserManagement = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [status, setStatus] = useState({ type: '', text: '' });

  // Separate state for role components during editing
  const [editRoleScope, setEditRoleScope] = useState('vertical');
  const [editRoleLevel, setEditRoleLevel] = useState('viewer');
  const [editVerticalPermissions, setEditVerticalPermissions] = useState({});

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
    setEditVerticalPermissions(user.vertical_permissions || {});
    setEditingUser({ ...user });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setLoading(true);
    setStatus({ type: '', text: '' });

    const newRoleId = `${editRoleScope}_${editRoleLevel}`;
    
    // If scope is master, they see all verticals. 
    // If scope is vertical, assigned_verticals are derived from keys with non-none levels.
    const finalVerticals = editRoleScope === 'master' 
      ? VERTICAL_LIST.map(v => v.id) 
      : Object.keys(editVerticalPermissions).filter(v => editVerticalPermissions[v] !== 'none');

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        role_id: newRoleId,
        assigned_verticals: finalVerticals,
        vertical_permissions: editRoleScope === 'master' ? {} : editVerticalPermissions
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

  const updateVerticalLevel = (vId, level) => {
    setEditVerticalPermissions(prev => ({
      ...prev,
      [vId]: level
    }));
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
                      u.vertical_permissions && Object.keys(u.vertical_permissions).length > 0 ? (
                        Object.entries(u.vertical_permissions).map(([vId, level]) => (
                          <span key={vId} className={`v-tag level-${level}`}>
                            {vId}: {level}
                          </span>
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

              {/* 3. Granular Vertical Permissions (Only for Vertical Scope) */}
              {editRoleScope === 'vertical' && (
                <div className="form-section vertical-assignment-section">
                  <label className="section-label">3. Configure Vertical Access Levels</label>
                  <div className="vertical-permission-list">
                    {VERTICAL_LIST.map(v => {
                      const currentLevel = editVerticalPermissions[v.id] || 'none';
                      return (
                        <div key={v.id} className="vertical-perm-item">
                          <span className="v-name">{v.label}</span>
                          <div className="v-level-selector">
                            {['none', 'viewer', 'contributor', 'editor', 'admin'].map(lvl => {
                              const maxRank = LEVEL_RANKS[editRoleLevel] || 1;
                              const isTooHigh = LEVEL_RANKS[lvl] > maxRank;

                              return (
                                <button
                                  key={lvl}
                                  type="button"
                                  className={`v-lvl-btn ${currentLevel === lvl ? 'active' : ''} lvl-${lvl}`}
                                  onClick={() => !isTooHigh && updateVerticalLevel(v.id, lvl)}
                                  disabled={isTooHigh}
                                  title={isTooHigh ? `Locked by max capability level (${editRoleLevel.toUpperCase()})` : ''}
                                  style={{ opacity: isTooHigh ? 0.3 : undefined, cursor: isTooHigh ? 'not-allowed' : undefined }}
                                >
                                  {lvl.toUpperCase()}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {Object.values(editVerticalPermissions).every(lvl => lvl === 'none') && (
                    <p className="selection-warning">⚠️ No access granted to any vertical.</p>
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
