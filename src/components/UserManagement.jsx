import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { VERTICAL_LIST } from '../constants/verticals';
import { ROLE_LEVELS, ROLE_SCOPES, DEFAULT_ROLE_PERMISSIONS } from '../constants/roles';
import { VERTICAL_FEATURES, getDefaultFeatures } from '../constants/verticalFeatures';
import MasterPageHeader from './MasterPageHeader';
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
  const [expandedFeatures, setExpandedFeatures] = useState(null); // Which vertical's features are being edited

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

  const handleOpenEdit = async (user) => {
    setLoading(true);
    const [scope, level] = user.role_id?.split('_') || ['vertical', 'viewer'];
    setEditRoleScope(scope);
    setEditRoleLevel(level);

    // Fetch granular permissions from specialized tables
    try {
      const { data: vAccess } = await supabase
        .from('vertical_access')
        .select('*')
        .eq('user_id', user.id);

      const { data: fAccess } = await supabase
        .from('feature_access')
        .select('*')
        .eq('user_id', user.id);

      const vPermsMap = {};
      (vAccess || []).forEach(v => {
        vPermsMap[v.vertical_id] = { level: v.access_level, features: {} };
      });
      (fAccess || []).forEach(f => {
        if (vPermsMap[f.vertical_id]) {
          vPermsMap[f.vertical_id].features[f.feature_id] = f.access_level;
        }
      });

      setEditVerticalPermissions(vPermsMap);
      setEditingUser({ ...user });
    } catch (err) {
      console.error("Error loading permissions:", err);
      setStatus({ type: 'error', text: 'Failed to load granular permissions.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    setStatus({ type: '', text: '' });

    const isMaster = editRoleScope === 'master';
    const newRoleId = `${editRoleScope}_${editRoleLevel}`;

    try {
      // 1. Update Profile (Base Role)
      const { error: pError } = await supabase
        .from('user_profiles')
        .update({ role_id: newRoleId })
        .eq('id', editingUser.id);
      
      if (pError) throw pError;

      if (!isMaster) {
        // 2. Clear old vertical/feature access for this user
        await supabase.from('vertical_access').delete().eq('user_id', editingUser.id);
        await supabase.from('feature_access').delete().eq('user_id', editingUser.id);

        const vInserts = [];
        const fInserts = [];

        Object.keys(editVerticalPermissions).forEach(vId => {
          const vData = editVerticalPermissions[vId];
          const vLvl = typeof vData === 'object' ? vData.level : vData;
          
          if (vLvl !== 'none') {
            vInserts.push({ user_id: editingUser.id, vertical_id: vId, access_level: vLvl });
            
            // Collect features
            if (typeof vData === 'object' && vData.features) {
              Object.keys(vData.features).forEach(fId => {
                const fLvl = vData.features[fId];
                if (fLvl !== 'none') {
                  fInserts.push({ user_id: editingUser.id, vertical_id: vId, feature_id: fId, access_level: fLvl });
                }
              });
            }
          }
        });

        if (vInserts.length > 0) await supabase.from('vertical_access').insert(vInserts);
        if (fInserts.length > 0) await supabase.from('feature_access').insert(fInserts);
      }

      setStatus({ type: 'success', text: 'Permissions successfully updated in the cloud.' });
      setEditingUser(null);
      await fetchUsers();
    } catch (err) {
      console.error("Sync Error:", err);
      setStatus({ type: 'error', text: `Sync Error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleLevelChange = (newLevel) => {
    setEditRoleLevel(newLevel);
    
    // CAP: Automatically downgrade any vertical permissions that exceed the new capability level
    const newMaxRank = LEVEL_RANKS[newLevel];
    setEditVerticalPermissions(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(vId => {
        const currentRank = LEVEL_RANKS[updated[vId]] || 0;
        if (currentRank > newMaxRank) {
          updated[vId] = newLevel;
        }
      });
      return updated;
    });
  };

  const updateVerticalLevel = (vId, level) => {
    setEditVerticalPermissions(prev => {
      const current = prev[vId];
      if (level === 'none') {
        const updated = { ...prev };
        delete updated[vId];
        return updated;
      }
      
      // If it was already an object, just update the level
      if (typeof current === 'object') {
        return {
          ...prev,
          [vId]: { ...current, level }
        };
      }
      
      // If it was a string or missing, upgrade to object with default features
      return {
        ...prev,
        [vId]: { level, features: getDefaultFeatures(vId) }
      };
    });
  };

  const updateFeatureLevel = (vId, fId, level) => {
    setEditVerticalPermissions(prev => {
      const current = prev[vId];
      if (typeof current !== 'object') return prev; 
      
      return {
        ...prev,
        [vId]: {
          ...current,
          features: {
            ...current.features,
            [fId]: level
          }
        }
      };
    });
  };

  if (loading && users.length === 0) return <div className="user-mgmt-loading">Loading Users...</div>;

  return (
    <div className="management-view-container">
      <MasterPageHeader
        title="User Management"
        description="Manage application users, their roles, and vertical access levels."
        rightActions={
          <div className="user-mgmt-actions">
            {/* Contextual actions could go here, like 'Invite User' if added later */}
          </div>
        }
      />

      {status.text && (
        <div className={`status-banner ${status.type}`} style={{ marginTop: '20px' }}>
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
                      (() => {
                        const vPerms = u.verticalPermissions || {}; // This will need App level normalization or fetch logic update
                        const activePerms = Object.entries(vPerms).filter(([_, data]) => data.level !== 'none');
                        
                        return activePerms.length > 0 ? (
                          activePerms.map(([vId, data]) => {
                            const hasCustomFeatures = Object.values(data.features || {}).some(lvl => lvl !== 'none' && lvl !== data.level);
                            return (
                              <span key={vId} className={`v-tag level-${data.level}`} title={hasCustomFeatures ? "Custom feature levels" : ""}>
                                {vId}: {data.level} {hasCustomFeatures && '⚙️'}
                              </span>
                            );
                          })
                        ) : (
                          <span className="v-tag locked">No Access</span>
                        );
                      })()
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
                        onClick={() => handleLevelChange(level.id)}
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
                        <div key={v.id} className="vertical-perm-item-wrapper">
                          <div className="vertical-perm-item">
                            <span className="v-name">{v.label}</span>
                            <div className="v-level-selector">
                              {['none', 'viewer', 'contributor', 'editor', 'admin'].map(lvl => {
                                const maxRank = LEVEL_RANKS[editRoleLevel] || 1;
                                const isTooHigh = LEVEL_RANKS[lvl] > maxRank;
                                const currentLevel = typeof editVerticalPermissions[v.id] === 'object' 
                                  ? editVerticalPermissions[v.id].level 
                                  : (editVerticalPermissions[v.id] || 'none');

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
                            
                            {VERTICAL_FEATURES[v.id] && currentLevel !== 'none' && (
                              <button
                                type="button"
                                className={`features-toggle-btn ${expandedFeatures === v.id ? 'active' : ''}`}
                                onClick={() => setExpandedFeatures(expandedFeatures === v.id ? null : v.id)}
                              >
                                {expandedFeatures === v.id ? 'Close' : 'Features'}
                              </button>
                            )}
                          </div>

                          {expandedFeatures === v.id && VERTICAL_FEATURES[v.id] && (
                            <div className="features-dropdown">
                              <p className="features-header">Configure feature-specific levels for {v.label}:</p>
                              <div className="features-level-list">
                                {VERTICAL_FEATURES[v.id].map(feature => {
                                  const fLevel = editVerticalPermissions[v.id]?.features?.[feature.id] || 'viewer';
                                  return (
                                    <div key={feature.id} className="feature-level-row">
                                      <span className="feature-label">{feature.label}</span>
                                      <div className="v-level-selector mini">
                                        {['none', 'viewer', 'contributor', 'editor', 'admin'].map(lvl => {
                                          const maxRank = LEVEL_RANKS[editRoleLevel] || 1;
                                          const isTooHigh = LEVEL_RANKS[lvl] > maxRank;
                                          
                                          return (
                                            <button
                                              key={lvl}
                                              type="button"
                                              className={`v-lvl-btn ${fLevel === lvl ? 'active' : ''} lvl-${lvl}`}
                                              onClick={() => !isTooHigh && updateFeatureLevel(v.id, feature.id, lvl)}
                                              disabled={isTooHigh}
                                              style={{ opacity: isTooHigh ? 0.3 : 1 }}
                                            >
                                              {lvl.charAt(0).toUpperCase()}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
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
