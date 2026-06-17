import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../services/core/supabaseClient';
import { userService } from '../services/auth/userService';
import { sortUsers } from './UserManagement/useUserManagement';
import { ROLE_LEVELS } from '../constants/roles';
import { IconX } from './Icons';
import RoleTooltip from './RoleTooltip';
import './BoardRBACModal.css';

const ACCESS_LEVELS = ['none', 'viewer', 'contributor', 'editor', 'admin'];

/**
 * BoardRBACModal
 *
 * Bug fix (2026-06-17): Modal now correctly reflects inherited permission levels.
 *
 * BEFORE: When a featureId is provided, the modal only fetched `feature_access`.
 * Users with no explicit feature row appeared as NONE, hiding their inherited
 * vertical-level access. This was misleading — it looked like everyone had no
 * access even when they did via the parent vertical.
 *
 * AFTER: The modal now:
 *   1. Always fetches both `vertical_access` AND `feature_access` (when featureId set).
 *   2. Builds an `inheritedMap` (vertical level) alongside the `accessMap` (feature override).
 *   3. Renders the active button as the EXPLICIT override if set, or the INHERITED level
 *      if no override exists — with a clear visual "(inherited)" sub-label.
 *   4. Sync only writes a feature_access row if the chosen level DIFFERS from the inherited
 *      level. Choosing the inherited level explicitly deletes any override (resets to inherit).
 */
const BoardRBACModal = ({ isOpen, onClose, verticalId, featureId, titleLabel }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Explicit overrides stored in feature_access (or vertical_access for vertical-level modals)
  const [accessMap, setAccessMap] = useState({}); // userId -> explicit access_level | undefined

  // Vertical-level access (only populated when featureId is set — used for inheritance display)
  const [inheritedMap, setInheritedMap] = useState({}); // userId -> inherited vertical level | undefined

  const [originalAccessMap, setOriginalAccessMap] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch users + access records
  // ---------------------------------------------------------------------------
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

      // 2. Fetch access records. When a featureId is set, ALWAYS also fetch vertical_access
      // so we can show the inherited level for users without an explicit feature override.
      let explicitAccessData = [];
      let verticalAccessData = [];

      if (featureId) {
        // Feature-level modal: fetch both explicit feature overrides AND vertical inheritance
        const [featureResult, verticalResult] = await Promise.all([
          supabase
            .from('feature_access')
            .select('user_id, access_level')
            .eq('vertical_id', verticalId)
            .eq('feature_id', featureId),
          supabase
            .from('vertical_access')
            .select('user_id, access_level')
            .eq('vertical_id', verticalId),
        ]);
        explicitAccessData = featureResult.data || [];
        verticalAccessData = verticalResult.data || [];
      } else {
        // Vertical-level modal: no inheritance concept, just fetch vertical_access directly
        const { data } = await supabase
          .from('vertical_access')
          .select('user_id, access_level')
          .eq('vertical_id', verticalId);
        explicitAccessData = data || [];
      }

      // 3. Build maps
      const accessMapping = {};
      explicitAccessData.forEach(row => {
        accessMapping[row.user_id] = row.access_level;
      });

      const inheritedMapping = {};
      verticalAccessData.forEach(row => {
        inheritedMapping[row.user_id] = row.access_level;
      });

      setUsers(sortedUsers);
      setAccessMap(accessMapping);
      setOriginalAccessMap({ ...accessMapping });
      setInheritedMap(inheritedMapping);
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
      setOriginalAccessMap({});
      setInheritedMap({});
    }
  }, [isOpen, fetchUsersAndAccess]);

  // ---------------------------------------------------------------------------
  // Local state change — sets an EXPLICIT override in accessMap.
  // Setting undefined removes the override (resets to inherit).
  // ---------------------------------------------------------------------------
  const handleAccessChange = (userId, newLevel) => {
    setAccessMap(prev => ({ ...prev, [userId]: newLevel }));
  };

  // ---------------------------------------------------------------------------
  // Derive the EFFECTIVE (displayed) level for a user:
  //   - If an explicit override exists → use it
  //   - Else if an inherited vertical level exists → use it (shown as "inherited")
  //   - Else → 'none'
  // ---------------------------------------------------------------------------
  const getEffectiveLevel = (userId) => {
    return accessMap[userId] ?? inheritedMap[userId] ?? 'none';
  };

  // Whether a user has an explicit feature-level override (vs. just inheriting)
  const hasExplicitOverride = (userId) => accessMap[userId] !== undefined;

  // ---------------------------------------------------------------------------
  // Sync changes to the database
  // ---------------------------------------------------------------------------
  const handleSyncPermissions = async () => {
    setIsSyncing(true);
    const errors = [];
    try {
      // Collect all user IDs touched since the modal opened (current + original maps)
      const allTouchedUserIds = new Set([
        ...Object.keys(accessMap),
        ...Object.keys(originalAccessMap),
      ]);

      for (const userId of allTouchedUserIds) {
        const newExplicit  = accessMap[userId];          // undefined  = user hit ↩ RESET
        const origExplicit = originalAccessMap[userId];  // undefined  = no row existed in DB

        // No change — skip to next user
        if (newExplicit === origExplicit) continue;

        if (featureId) {
          if (newExplicit === undefined) {
            // ↩ RESET was clicked — delete the feature_access row to restore inheritance
            if (origExplicit !== undefined) {
              const { error } = await supabase
                .from('feature_access')
                .delete()
                .match({ user_id: userId, vertical_id: verticalId, feature_id: featureId });
              if (error) errors.push(`Delete failed for ${userId}: ${error.message}`);
            }
          } else {
            // Any explicit level (including levels that match the inherited vertical level) →
            // always upsert a feature_access row. This is the only way to promote a user
            // from "inherited" to "explicitly set", even if the value is the same.
            const { error } = await supabase
              .from('feature_access')
              .upsert(
                { user_id: userId, vertical_id: verticalId, feature_id: featureId, access_level: newExplicit },
                { onConflict: 'user_id,vertical_id,feature_id' }
              );
            if (error) errors.push(`Upsert failed for ${userId}: ${error.message}`);
          }
        } else {
          // Vertical-level modal (no inheritance concept)
          if (newExplicit === undefined || newExplicit === 'none') {
            if (origExplicit !== undefined) {
              const { error } = await supabase
                .from('vertical_access')
                .delete()
                .match({ user_id: userId, vertical_id: verticalId });
              if (error) errors.push(`Delete failed for ${userId}: ${error.message}`);
            }
          } else {
            const { error } = await supabase
              .from('vertical_access')
              .upsert(
                { user_id: userId, vertical_id: verticalId, access_level: newExplicit },
                { onConflict: 'user_id,vertical_id' }
              );
            if (error) errors.push(`Upsert failed for ${userId}: ${error.message}`);
          }
        }
      }

      if (errors.length > 0) {
        console.error('[BoardRBACModal] Sync errors:', errors);
        alert(`Some permissions failed to save:\n${errors.join('\n')}`);
      }

      // Always re-fetch so the UI reflects the true DB state
      await fetchUsersAndAccess();
    } catch (err) {
      console.error('Error syncing access:', err);
      alert('Failed to sync permissions. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  // Whether any explicit override has changed vs. the saved state
  const hasPendingChanges = users.some(u => accessMap[u.id] !== originalAccessMap[u.id]);

  return createPortal(
    <div className="board-rbac-overlay">
      <div className="board-rbac-modal">
        <header className="board-rbac-header">
          <div className="board-rbac-title-group">
            <h3>Manage Access: {titleLabel}</h3>
            <span className="board-rbac-subtitle">
              Configure who can access this {featureId ? 'feature' : 'board'} and at what level.
              {featureId && (
                <span className="board-rbac-inherit-note">
                  {' '}Levels shown without a label are inherited from the vertical.
                </span>
              )}
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
                  const effectiveLevel  = getEffectiveLevel(user.id);
                  const isExplicit      = hasExplicitOverride(user.id);
                  const inherited       = inheritedMap[user.id];
                  const originalLevel   = originalAccessMap[user.id];
                  const hasChanged      = accessMap[user.id] !== originalLevel;
                  const isMasterAdmin   = user.role_id === 'master_admin';

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
                            {ACCESS_LEVELS.map(lvl => {
                              // A button is "active" if this level is the current effective level
                              const isActive = effectiveLevel === lvl;
                              // "Inherited" label: level matches inherited AND no explicit override was set
                              const isInherited = featureId && !isExplicit && inherited === lvl && lvl !== 'none';
                              // "Changed" indicator: this button IS the active one AND state differs from saved
                              const isChanged = isActive && hasChanged;

                              return (
                                <RoleTooltip
                                  key={lvl}
                                  level={lvl}
                                  contextName={titleLabel}
                                  isFeature={!!featureId}
                                >
                                  <button
                                    className={[
                                      'access-lvl-btn',
                                      `lvl-${lvl}`,
                                      isActive    ? 'active'       : '',
                                      isInherited ? 'is-inherited' : '',
                                      isChanged   ? 'has-changed'  : '',
                                    ].filter(Boolean).join(' ')}
                                    onClick={() => handleAccessChange(user.id, lvl)}
                                    disabled={isSyncing}
                                    title={isInherited ? `Inherited from vertical: ${lvl}` : undefined}
                                  >
                                    {lvl.toUpperCase()}
                                    {isInherited && (
                                      <span className="access-lvl-inherited-tag">inherited</span>
                                    )}
                                  </button>
                                </RoleTooltip>
                              );
                            })}
                            {/* Reset to inherit button — only shown for feature modals with an explicit override */}
                            {featureId && isExplicit && (
                              <button
                                className="access-lvl-btn access-lvl-reset"
                                onClick={() => handleAccessChange(user.id, undefined)}
                                disabled={isSyncing}
                                title={`Reset to inherited vertical level${inherited ? `: ${inherited}` : ''}`}
                              >
                                ↩ RESET
                              </button>
                            )}
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

        <div className="board-rbac-footer">
          {hasPendingChanges && (
            <span className="board-rbac-pending-note">Unsaved changes</span>
          )}
          <button
            className="halo-button"
            onClick={handleSyncPermissions}
            disabled={loading || isSyncing || !hasPendingChanges}
          >
            {isSyncing ? 'Syncing...' : 'Sync Permissions'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BoardRBACModal;
