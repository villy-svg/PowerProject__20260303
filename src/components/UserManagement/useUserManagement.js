import { useState, useEffect, useCallback } from 'react';
import { userService } from '../../services/auth/userService';
import { supabase } from '../../services/core/supabaseClient';
import { getDefaultFeatures } from '../../constants/verticalFeatures';
import { ROLE_LEVELS } from '../../constants/roles';

export const LEVEL_RANKS = { none: 0, viewer: 1, contributor: 2, editor: 3, admin: 4 };

/**
 * useUserManagement Hook
 * Logic engine for the User Management dashboard.
 * Handles user list fetching and atomic permission syncing.
 */
export const useUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [status, setStatus] = useState({ type: '', text: '' });
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('user_mgmt_view_mode') || 'list');

  // Modal State
  const [editRoleScope, setEditRoleScope] = useState('vertical');
  const [editRoleLevel, setEditRoleLevel] = useState('viewer');
  const [editVerticalPermissions, setEditVerticalPermissions] = useState({});
  const [expandedFeatures, setExpandedFeatures] = useState(null);

  // 1. Fetch Users
  const fetchUsers = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // 1a. Fetch basic profile & employee link
      const profiles = await userService.fetchUsers();

      // 1b. Fetch all vertical access for mapping (Batch fetch for list view)
      const { data: vAccess } = await supabase
        .from('vertical_access')
        .select('user_id, vertical_id, access_level');

      // 1c. Merge data
      const merged = (profiles || []).map(u => {
        const uAccess = (vAccess || []).filter(va => va.user_id === u.id);
        const vPerms = {};
        uAccess.forEach(va => {
            vPerms[va.vertical_id] = { level: va.access_level };
        });
        return { ...u, verticalPermissions: vPerms };
      });

      setUsers(merged);
    } catch (err) {
      console.error("Error fetching users:", err.message);
      setStatus({ type: 'error', text: 'Failed to load user records.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Persist View Mode
  useEffect(() => {
    localStorage.setItem('user_mgmt_view_mode', viewMode);
  }, [viewMode]);

  // 2. Open Editor
  const openEditor = async (user) => {
    setLoading(true);
    const [scope, level] = user.role_id?.split('_') || ['vertical', 'viewer'];
    setEditRoleScope(scope);
    setEditRoleLevel(level);

    try {
      const perms = await userService.fetchUserPermissions(user.id);
      
      const vPermsMap = {};
      (perms.verticals || []).forEach(v => {
        vPermsMap[v.vertical_id] = { level: v.access_level, features: {} };
      });
      (perms.features || []).forEach(f => {
        if (vPermsMap[f.vertical_id]) {
          vPermsMap[f.vertical_id].features[f.feature_id] = f.access_level;
        }
      });

      setEditVerticalPermissions(vPermsMap);
      setEditingUser({ ...user });
    } catch (err) {
      setStatus({ type: 'error', text: 'Failed to load granular permissions.' });
    } finally {
      setLoading(false);
    }
  };

  const closeEditor = () => {
    setEditingUser(null);
    setExpandedFeatures(null);
  };

  // 3. Update Sync
  const handleSyncPermissions = async (e) => {
    if (e) e.preventDefault();
    if (!editingUser) return;
    
    setLoading(true);
    setStatus({ type: '', text: '' });

    try {
        const roleId = `${editRoleScope}_${editRoleLevel}`;
        
        // Prepare grants for RPC
        const vGrants = [];
        const fGrants = [];

        if (editRoleScope !== 'master') {
          Object.keys(editVerticalPermissions).forEach(vId => {
            const vData = editVerticalPermissions[vId];
            const vLvl = vData.level;
            
            if (vLvl !== 'none') {
                vGrants.push({ vertical_id: vId, access_level: vLvl });
                
                if (vData.features) {
                    Object.keys(vData.features).forEach(fId => {
                        const fLvl = vData.features[fId];
                        if (fLvl !== 'none') {
                            fGrants.push({ vertical_id: vId, feature_id: fId, access_level: fLvl });
                        }
                    });
                }
            }
          });
        }

        await userService.syncPermissions({
            userId: editingUser.id,
            roleId,
            verticalGrants: vGrants,
            featureGrants: fGrants
        });

        setStatus({ type: 'success', text: `Permissions for ${editingUser.name} synced and hardened.` });
        closeEditor();
        await fetchUsers(false);
    } catch (err) {
        console.error("Sync Failure:", err.message);
        setStatus({ type: 'error', text: `Security Sync Failed: ${err.message}` });
    } finally {
        setLoading(false);
    }
  };

  // 4. Permission Helpers (Capping Logic)
  const handleLevelChange = (newLevel) => {
    setEditRoleLevel(newLevel);
    const newMaxRank = LEVEL_RANKS[newLevel];

    setEditVerticalPermissions(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(vId => {
        const current = updated[vId];
        const updatedLevel = LEVEL_RANKS[current.level] > newMaxRank ? newLevel : current.level;
        const updatedFeatures = { ...current.features };
        
        Object.keys(updatedFeatures).forEach(fId => {
          if (LEVEL_RANKS[updatedFeatures[fId]] > newMaxRank) {
            updatedFeatures[fId] = newLevel;
          }
        });
        
        updated[vId] = { ...current, level: updatedLevel, features: updatedFeatures };
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
      
      if (current) {
        const updatedFeatures = { ...current.features };
        Object.keys(updatedFeatures).forEach(fId => {
          if (LEVEL_RANKS[updatedFeatures[fId]] > newMaxRank) {
            updatedFeatures[fId] = level;
          }
        });
        return { ...prev, [vId]: { ...current, level, features: updatedFeatures } };
      }
      
      return { ...prev, [vId]: { level, features: getDefaultFeatures(vId) } };
    });
  };

  const updateFeatureLevel = (vId, fId, level) => {
    setEditVerticalPermissions(prev => {
      const current = prev[vId];
      if (!current) return prev; 
      return {
        ...prev,
        [vId]: {
          ...current,
          features: { ...current.features, [fId]: level }
        }
      };
    });
  };

  return {
    users, loading, viewMode, setViewMode, status, setStatus,
    editingUser, openEditor, closeEditor, handleSyncPermissions,
    editRoleScope, setEditRoleScope,
    editRoleLevel, handleLevelChange,
    editVerticalPermissions, updateVerticalLevel, updateFeatureLevel,
    expandedFeatures, setExpandedFeatures
  };
};
