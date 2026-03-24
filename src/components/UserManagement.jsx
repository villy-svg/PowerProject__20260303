import React, { useState, useEffect } from 'react';
import { supabase } from '../services/core/supabaseClient';
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

  const [viewMode, setViewMode] = useState('list');
  const [expandedFeatures, setExpandedFeatures] = useState(null); // Which vertical's features are being edited

  // Separate state for role components during editing
  const [editRoleScope, setEditRoleScope] = useState('vertical');
  const [editRoleLevel, setEditRoleLevel] = useState('viewer');
  const [editVerticalPermissions, setEditVerticalPermissions] = useState({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    // 1. Fetch profiles
    const { data: profiles, error: pError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (pError) {
      console.error("Error fetching users:", pError.message);
      setStatus({ type: 'error', text: 'Failed to load users.' });
      setLoading(false);
      return;
    }

    // 2. Fetch all vertical access records to map permissions
    const { data: vAccess, error: vError } = await supabase
      .from('vertical_access')
      .select('user_id, vertical_id, access_level');

    if (vError) {
      console.error("Error loading vertical data:", vError.message);
    }

    // 3. Fetch employees to map to users by email
    const { data: empData, error: eError } = await supabase
      .from('employees')
      .select('id, full_name, email, emp_code, status');

    if (eError) {
      console.error("Error loading employee data:", eError.message);
    }

    // 4. Merge vertical IDs and employee data into the profile objects for display
    const mergedData = (profiles || []).map(u => {
      const uAccess = (vAccess || []).filter(va => va.user_id === u.id);
      const vPerms = {};
      uAccess.forEach(va => {
        vPerms[va.vertical_id] = { level: va.access_level };
      });
      
      // Prefer direct database link (employee_id) over email matching
      const linkedEmployee = u.employee_id 
        ? (empData || []).find(e => e.id === u.employee_id) 
        : (empData || []).find(e => e.email && u.email && e.email.toLowerCase() === u.email.toLowerCase()) || null;

      return { ...u, verticalPermissions: vPerms, linkedEmployee };
    });

    setUsers(mergedData);
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
    
    // CAP: Automatically downgrade any vertical or feature permissions that exceed the new capability level
    const newMaxRank = LEVEL_RANKS[newLevel];
    setEditVerticalPermissions(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(vId => {
        const current = updated[vId];
        if (typeof current === 'object') {
          // Downgrade Vertical Level
          const updatedLevel = LEVEL_RANKS[current.level] > newMaxRank ? newLevel : current.level;
          
          // Downgrade Features
          const updatedFeatures = { ...current.features };
          Object.keys(updatedFeatures).forEach(fId => {
            if (LEVEL_RANKS[updatedFeatures[fId]] > newMaxRank) {
              updatedFeatures[fId] = newLevel;
            }
          });
          
          updated[vId] = { ...current, level: updatedLevel, features: updatedFeatures };
        } else {
          // Legacy string format
          if (LEVEL_RANKS[current] > newMaxRank) {
            updated[vId] = newLevel;
          }
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
      
      const newMaxRank = LEVEL_RANKS[level];
      
      // If it was already an object, update level and downgrade features
      if (typeof current === 'object') {
        const updatedFeatures = { ...current.features };
        Object.keys(updatedFeatures).forEach(fId => {
          if (LEVEL_RANKS[updatedFeatures[fId]] > newMaxRank) {
            updatedFeatures[fId] = level;
          }
        });
        
        return {
          ...prev,
          [vId]: { ...current, level, features: updatedFeatures }
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
        leftActions={
          <div className="view-mode-toggle">
            <button 
              className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </button>
            <button 
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
        }
        rightActions={
          <div className="user-mgmt-actions">
            {/* Contextual actions could go here */}
          </div>
        }
      />

      {status.text && (
        <div className={`status-banner ${status.type}`} style={{ marginTop: '20px' }}>
          {status.text}
          <button onClick={() => setStatus({ type: '', text: '' })}>×</button>
        </div>
      )}

      {viewMode === 'list' ? (
        <div className="user-list-wrapper">
          <table className="user-table">
            <thead>
              <tr>
                <th>Name / Email</th>
                <th>Role</th>
                <th>Vertical Access</th>
                <th>Employee Link</th>
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
                        <span className="v-tag master">All Verticals</span>
                      ) : (
                        (() => {
                          const vPerms = u.verticalPermissions || {}; 
                          const activeVIds = Object.entries(vPerms)
                            .filter(([_, data]) => data.level !== 'none')
                            .map(([vId]) => {
                              const vInfo = VERTICAL_LIST.find(v => v.id === vId);
                              return vInfo ? vInfo.label : vId;
                            });
                          
                          return activeVIds.length > 0 ? (
                            activeVIds.map(vLabel => (
                              <span key={vLabel} className="v-tag simple">
                                {vLabel}
                              </span>
                            ))
                          ) : (
                            <span className="v-tag locked">No Access</span>
                          );
                        })()
                      )}
                    </div>
                  </td>
                  <td>
                    {u.linkedEmployee ? (
                      <div className="employee-link-badge">
                        <span className="v-tag simple linked" style={{background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)'}}>
                          ✓ Linked: {u.linkedEmployee.full_name} ({u.linkedEmployee.emp_code})
                        </span>
                      </div>
                    ) : (
                      <span className="v-tag locked" style={{opacity: 0.6}}>Not an Employee</span>
                    )}
                  </td>
                  <td>
                    <button className="halo-button edit-user-btn" onClick={() => handleOpenEdit(u)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="user-grid">
          {users.map(u => (
            <div key={u.id} className="user-card">
              <div className="user-card-header">
                <div className="user-card-id">
                  <span className="user-name">{u.name}</span>
                  <span className="user-email">{u.email}</span>
                </div>
                <span className={`role-badge ${u.role_id}`}>
                  {u.role_id?.replace('_', ' ')}
                </span>
              </div>
              
              <div className="user-card-body">
                <label>Access Verticals</label>
                <div className="vertical-tags">
                  {u.role_id?.startsWith('master') ? (
                    <span className="v-tag master">All Verticals</span>
                  ) : (
                    (() => {
                      const vPerms = u.verticalPermissions || {};
                      const activeVIds = Object.entries(vPerms)
                        .filter(([_, data]) => data.level !== 'none')
                        .map(([vId]) => {
                          const vInfo = VERTICAL_LIST.find(v => v.id === vId);
                          return vInfo ? vInfo.label : vId;
                        });
                      return activeVIds.length > 0 ? (
                        activeVIds.map(vLabel => (
                          <span key={vLabel} className="v-tag simple">{vLabel}</span>
                        ))
                      ) : (
                        <span className="v-tag locked">No Access</span>
                      );
                    })()
                  )}
                </div>
                
                <label style={{marginTop: '12px'}}>Employee Profile</label>
                <div className="employee-link-status" style={{marginTop: '4px'}}>
                  {u.linkedEmployee ? (
                    <span className="v-tag simple linked" style={{background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)'}}>
                      ✓ {u.linkedEmployee.full_name} ({u.linkedEmployee.emp_code})
                    </span>
                  ) : (
                    <span className="v-tag locked" style={{opacity: 0.6}}>Not an Employee</span>
                  )}
                </div>
              </div>

              <div className="user-card-actions">
                <button className="halo-button edit-user-btn" onClick={() => handleOpenEdit(u)}>
                  Edit Permissions
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
                      const vData = editVerticalPermissions[v.id];
                      const normalizedVLevel = typeof vData === 'object' ? vData.level : (vData || 'none');
                      
                      return (
                        <div key={v.id} className="vertical-perm-item-wrapper">
                            <div className="vertical-perm-item">
                            <div className="left-side-controls">
                              {VERTICAL_FEATURES[v.id] && normalizedVLevel !== 'none' && (
                                <button
                                  type="button"
                                  className={`features-toggle-btn ${expandedFeatures === v.id ? 'active' : ''}`}
                                  onClick={() => setExpandedFeatures(expandedFeatures === v.id ? null : v.id)}
                                  title="Toggle Features"
                                >
                                  <span className={`chevron ${expandedFeatures === v.id ? 'up' : 'down'}`}></span>
                                </button>
                              )}
                              <span className="v-name">{v.label}</span>
                            </div>
                            
                            <div className="v-level-selector">
                              {['none', 'viewer', 'contributor', 'editor', 'admin'].map(lvl => {
                                const maxRank = LEVEL_RANKS[editRoleLevel] || 1;
                                const isTooHigh = LEVEL_RANKS[lvl] > maxRank;

                                return (
                                  <button
                                    key={lvl}
                                    type="button"
                                    className={`v-lvl-btn ${normalizedVLevel === lvl ? 'active' : ''} lvl-${lvl}`}
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

                          {expandedFeatures === v.id && VERTICAL_FEATURES[v.id] && (
                            <div className="features-dropdown">
                              <p className="features-header">Configure feature-specific levels for {v.label}:</p>
                              <div className="features-level-list">
                                {VERTICAL_FEATURES[v.id].map(feature => {
                                  const fLevel = editVerticalPermissions[v.id]?.features?.[feature.id] || 'none';
                                  return (
                                    <div key={feature.id} className="feature-level-row">
                                      <span className="feature-label">{feature.label}</span>
                                      <div className="v-level-selector mini">
                                        {['none', 'viewer', 'contributor', 'editor', 'admin'].map(lvl => {
                                          const globalMaxRank = LEVEL_RANKS[editRoleLevel] || 1;
                                          const verticalMaxRank = LEVEL_RANKS[normalizedVLevel] || 1;
                                          const isTooHigh = LEVEL_RANKS[lvl] > Math.min(globalMaxRank, verticalMaxRank);
                                          
                                          return (
                                            <button
                                              key={lvl}
                                              type="button"
                                              className={`v-lvl-btn ${fLevel === lvl ? 'active' : ''} lvl-${lvl}`}
                                              onClick={() => !isTooHigh && updateFeatureLevel(v.id, feature.id, lvl)}
                                              disabled={isTooHigh}
                                              title={isTooHigh ? `Locked by vertical access level (${normalizedVLevel.toUpperCase()})` : ''}
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
