import { useState, useEffect, useCallback } from 'react';
import { userService } from '../../services/auth/userService';
import { supabase } from '../../services/core/supabaseClient';
import { getDefaultFeatures } from '../../constants/verticalFeatures';
import { ROLE_LEVELS } from '../../constants/roles';

export const LEVEL_RANKS = { none: 0, viewer: 1, contributor: 2, editor: 3, admin: 4 };

export const sortUsers = (userList) => {
  const sorted = [...userList].sort((a, b) => {
    // Rule 1: Active above Inactive
    const aActive = a.is_active !== false;
    const bActive = b.is_active !== false;
    if (aActive !== bActive) {
      return aActive ? -1 : 1;
    }

    // Helper to get seniority level from multiple possible database relation paths
    const getSeniority = (u) => {
      const emp = u.linkedEmployee;
      if (!emp) return 0;
      
      // 1. Check if seniority_level is already flattened
      if (typeof emp.seniority_level === 'number') {
        return emp.seniority_level;
      }
      
      // 2. Check if employee_roles is joined
      const roles = emp.employee_roles;
      if (!roles) return 0;
      
      // Support array of roles or single role object
      if (Array.isArray(roles)) {
        return roles[0]?.seniority_level ?? 0;
      }
      return roles.seniority_level ?? 0;
    };

    const aSeniority = getSeniority(a);
    const bSeniority = getSeniority(b);
    if (aSeniority !== bSeniority) {
      return bSeniority - aSeniority; // Higher seniority (larger number) comes first
    }

    // Stable fallback: Alphabetical by Name
    const aName = a.name || '';
    const bName = b.name || '';
    return aName.localeCompare(bName);
  });

  // Diagnostic log to verify sorting scores in the browser console
  console.log('[UserManagement] Sorted users list:', sorted.map(u => ({
    name: u.name,
    active: u.is_active !== false,
    seniority: u.linkedEmployee ? (u.linkedEmployee.seniority_level || u.linkedEmployee.employee_roles?.seniority_level || u.linkedEmployee.employee_roles?.[0]?.seniority_level || 0) : 0
  })));

  return sorted;
};

/**
 * useUserManagement Hook
 * Logic engine for the User Management dashboard.
 * Handles user list fetching, atomic permission syncing, and user activation toggling.
 * Includes mass syncing capabilities.
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
      // 1a. Fetch basic profiles, all employees (for self-healing matching), and vertical access
      const [profiles, { data: allEmployees }, { data: vAccess }] = await Promise.all([
        userService.fetchUsers(),
        supabase.from('employees').select('*, employee_roles(seniority_level)'),
        supabase.from('vertical_access').select('user_id, vertical_id, access_level')
      ]);

      // 1b. Merge data and self-heal missing employee links
      const merged = (profiles || []).map(u => {
        const uAccess = (vAccess || []).filter(va => va.user_id === u.id);
        const vPerms = {};
        uAccess.forEach(va => {
            vPerms[va.vertical_id] = { level: va.access_level };
        });

        let linkedEmployee = u.linkedEmployee;

        // Self-heal: If database link is missing, match by email case-insensitively
        if (!linkedEmployee && u.email && allEmployees) {
          const matched = allEmployees.find(emp => emp.email && emp.email.toLowerCase() === u.email.toLowerCase());
          if (matched) {
            linkedEmployee = {
              ...matched,
              // Format employee_roles joined data so it matches the structure expected by UserList and sortUsers
              employee_roles: matched.employee_roles
            };

            // Proactively heal database reference in background (non-blocking)
            supabase.from('user_profiles')
              .update({ employee_id: matched.id })
              .eq('id', u.id)
              .then(({ error }) => {
                if (error) {
                  console.warn(`[SelfHealing] Failed to heal employee link for user ${u.name}:`, error.message);
                } else {
                  console.log(`[SelfHealing] Successfully linked employee ${matched.full_name} to user ${u.name} in DB`);
                }
              });
          }
        }

        return { ...u, linkedEmployee, verticalPermissions: vPerms };
      });

      setUsers(sortUsers(merged));
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

      // Re-hydrate ALL explicit feature_access rows from the DB.
      // This is critical: any feature override written by the Manage RBAC modal
      // must survive a subsequent User Management save — we preserve it by loading
      // it into editVerticalPermissions so handleSyncPermissions re-emits it.
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

              // Re-emit ALL explicit feature_access rows, including those that match
              // the vertical level. The RPC does a full wipe+replace, so omitting
              // any existing row would silently delete it — breaking any override
              // previously set via the Manage RBAC modal.
              if (vData.features) {
                Object.keys(vData.features).forEach(fId => {
                  const fLvl = vData.features[fId];
                  // Only skip truly absent/none entries to avoid writing noise rows.
                  // We DO write rows matching the vertical level (they are explicit overrides).
                  if (fLvl && fLvl !== 'none') {
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

  // 3b. Mass Sync Permissions
  const handleMassSyncPermissions = async (sourceUserId, targetUserIds) => {
    if (!sourceUserId || !targetUserIds || targetUserIds.length === 0) return;
    
    setLoading(true);
    setStatus({ type: '', text: '' });

    try {
      // Find source user role from loaded profile list
      const sourceUser = users.find(u => u.id === sourceUserId);
      if (!sourceUser) throw new Error("Source user not found.");

      // Fetch granular permissions from source
      const perms = await userService.fetchUserPermissions(sourceUserId);
      
      const vGrants = (perms.verticals || []).map(v => ({ 
        vertical_id: v.vertical_id, 
        access_level: v.access_level 
      }));

      const fGrants = (perms.features || []).map(f => ({
        vertical_id: f.vertical_id,
        feature_id: f.feature_id,
        access_level: f.access_level
      }));

      // Map through all target users and fire a sync request for each
      // The RPC 'sync_user_permissions' manages wiping and replacing existing permissions cleanly
      await Promise.all(targetUserIds.map(tId => 
        userService.syncPermissions({
          userId: tId,
          roleId: sourceUser.role_id,
          verticalGrants: vGrants,
          featureGrants: fGrants
        })
      ));

      setStatus({ type: 'success', text: `Permissions successfully cloned to ${targetUserIds.length} user(s).` });
      await fetchUsers(false);
    } catch (err) {
      console.error("Mass Sync Failure:", err.message);
      setStatus({ type: 'error', text: `Mass Sync Failed: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // 4. Deactivate User
  // Optimistically updates local state, then calls the RPC, then refreshes.
  const handleDeactivate = async (userId) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    // Optimistic update
    setUsers(prev => sortUsers(prev.map(u =>
      u.id === userId ? { ...u, is_active: false, role_id: 'vertical_viewer', verticalPermissions: {} } : u
    )));
    setStatus({ type: '', text: '' });

    try {
      await userService.deactivateUser(userId);
      setStatus({ type: 'success', text: `${targetUser.name} has been deactivated and all access removed.` });
      await fetchUsers(false);
    } catch (err) {
      // Rollback optimistic update on failure
      setUsers(prev => sortUsers(prev.map(u => u.id === userId ? targetUser : u)));
      console.error("Deactivation failed:", err.message);
      setStatus({ type: 'error', text: `Deactivation failed: ${err.message}` });
    }
  };

  // 5. Reactivate User
  // Optimistically updates local state, then calls the RPC, then refreshes.
  const handleReactivate = async (userId) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    // Optimistic update
    setUsers(prev => sortUsers(prev.map(u =>
      u.id === userId ? { ...u, is_active: true } : u
    )));
    setStatus({ type: '', text: '' });

    try {
      await userService.reactivateUser(userId);
      setStatus({
        type: 'success',
        text: `${targetUser.name} reactivated. They have base access only — re-grant permissions via the Permission Editor.`
      });
      await fetchUsers(false);
    } catch (err) {
      // Rollback optimistic update on failure
      setUsers(prev => sortUsers(prev.map(u => u.id === userId ? targetUser : u)));
      console.error("Reactivation failed:", err.message);
      setStatus({ type: 'error', text: `Reactivation failed: ${err.message}` });
    }
  };

  // 6. Permission Helpers (Capping Logic)
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
    editingUser, openEditor, closeEditor, handleSyncPermissions, handleMassSyncPermissions,
    handleDeactivate, handleReactivate,
    editRoleScope, setEditRoleScope,
    editRoleLevel, handleLevelChange,
    editVerticalPermissions, updateVerticalLevel, updateFeatureLevel,
    expandedFeatures, setExpandedFeatures
  };
};


