import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/core/supabaseClient';
import { userService } from '../services/auth/userService';
import { sortUsers } from './UserManagement/useUserManagement';
import { ROLE_LEVELS } from '../constants/roles';
import { IconX } from './Icons';
import './BoardRBACModal.css';

const ACCESS_LEVELS = ['none', 'viewer', 'contributor', 'editor', 'admin'];

const BoardRBACModal = ({ isOpen, onClose, verticalId, featureId, titleLabel }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessMap, setAccessMap] = useState({}); // userId -> access_level
  const [savingUserId, setSavingUserId] = useState(null);

  const fetchUsersAndAccess = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Users & Employees (for sorting/self-healing)
      const [profiles, { data: allEmployees }] = await Promise.all([
        userService.fetchUsers(),
        supabase.from('employees').select('*, employee_roles(seniority_level)')
      ]);

      const merged = (profiles || []).map(u => {
        let linkedEmployee = u.linkedEmployee;
        if (!linkedEmployee && u.email && allEmployees) {
          const matched = allEmployees.find(emp => emp.email && emp.email.toLowerCase() === u.email.toLowerCase());
          if (matched) {
            linkedEmployee = { ...matched, employee_roles: matched.employee_roles };
          }
        }
        return { ...u, linkedEmployee };
      });

      const sortedUsers = sortUsers(merged);

      // 2. Fetch specific access records
      let accessData = [];
      if (featureId) {
        const { data } = await supabase
          .from('feature_access')
          .select('user_id, access_level')
          .eq('vertical_id', verticalId)
          .eq('feature_id', featureId);
        accessData = data || [];
      } else {
        const { data } = await supabase
          .from('vertical_access')
          .select('user_id, access_level')
          .eq('vertical_id', verticalId);
        accessData = data || [];
      }

      const accessMapping = {};
      accessData.forEach(row => {
        accessMapping[row.user_id] = row.access_level;
      });

      setUsers(sortedUsers);
      setAccessMap(accessMapping);
    } catch (err) {
      console.error('Error fetching RBAC data:', err);
    } finally {
      setLoading(false);
    }
  }, [verticalId, featureId]);

  useEffect(() => {
    if (isOpen) {
      fetchUsersAndAccess();
    } else {
      setUsers([]);
      setAccessMap({});
    }
  }, [isOpen, fetchUsersAndAccess]);

  const handleAccessChange = async (userId, newLevel) => {
    setSavingUserId(userId);
    try {
      // Update local state optimistically
      setAccessMap(prev => ({ ...prev, [userId]: newLevel }));

      if (newLevel === 'none') {
        // Delete record
        if (featureId) {
          await supabase
            .from('feature_access')
            .delete()
            .match({ user_id: userId, vertical_id: verticalId, feature_id: featureId });
        } else {
          await supabase
            .from('vertical_access')
            .delete()
            .match({ user_id: userId, vertical_id: verticalId });
        }
      } else {
        // Upsert record
        if (featureId) {
          await supabase
            .from('feature_access')
            .upsert({ user_id: userId, vertical_id: verticalId, feature_id: featureId, access_level: newLevel }, { onConflict: 'user_id,vertical_id,feature_id' });
        } else {
          await supabase
            .from('vertical_access')
            .upsert({ user_id: userId, vertical_id: verticalId, access_level: newLevel }, { onConflict: 'user_id,vertical_id' });
        }
      }
    } catch (err) {
      console.error('Error updating access:', err);
      // Revert optimistic update on error
      fetchUsersAndAccess(); 
    } finally {
      setSavingUserId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="board-rbac-overlay">
      <div className="board-rbac-modal">
        <header className="board-rbac-header">
          <div className="board-rbac-title-group">
            <h3>Manage Access: {titleLabel}</h3>
            <span className="board-rbac-subtitle">
              Configure who can access this {featureId ? 'feature' : 'board'} and at what level.
            </span>
          </div>
          <button className="board-rbac-close" onClick={onClose}>
            <IconX size={20} />
          </button>
        </header>

        <div className="board-rbac-content">
          {loading ? (
            <div className="board-rbac-loading">Loading users...</div>
          ) : (
            <div className="board-rbac-list">
              <div className="board-rbac-list-header">
                <div className="col-user">User</div>
                <div className="col-access">Access Level</div>
              </div>
              
              <div className="board-rbac-list-body">
                {users.map(user => {
                  const currentLevel = accessMap[user.id] || 'none';
                  const isSaving = savingUserId === user.id;

                  // Admin is master_admin, they bypass these granular controls usually, 
                  // but we still let them configure other users. If this user IS master_admin, 
                  // we might disable it, but standard flow allows it. We'll disable for master_admin for safety.
                  const isMasterAdmin = user.role_id === 'master_admin';

                  return (
                    <div key={user.id} className={`board-rbac-row ${!user.is_active ? 'inactive-user' : ''}`}>
                      <div className="col-user">
                        <div className="user-info">
                          <span className="user-name">{user.name}</span>
                          {!user.is_active && <span className="inactive-badge">Inactive</span>}
                        </div>
                        <span className="user-email">{user.email}</span>
                      </div>
                      <div className="col-access">
                        {isMasterAdmin ? (
                          <span className="master-admin-badge">Master Admin (All Access)</span>
                        ) : (
                          <div className="access-selector-group">
                            {ACCESS_LEVELS.map(lvl => (
                              <button
                                key={lvl}
                                className={`access-lvl-btn ${currentLevel === lvl ? 'active' : ''} lvl-${lvl}`}
                                onClick={() => handleAccessChange(user.id, lvl)}
                                disabled={isSaving}
                              >
                                {lvl.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BoardRBACModal;
