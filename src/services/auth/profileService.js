/**
 * Profile Service
 * Handles all user profile and RBAC permission fetching from Supabase.
 * Canonical location: src/services/auth/profileService.js
 *
 * Consuming component: src/App.jsx (replaces inline fetchUserProfile function)
 * Usage:
 *   import { profileService } from '../services/auth/profileService';
 *   const user = await profileService.fetchUserProfile(userId);
 */
import { supabase } from '../core/supabaseClient';

export const profileService = {
  /**
   * Fetches all user profile data and assembles a normalized user object.
   * Queries: user_profiles, role_permissions, vertical_access, feature_access.
   *
   * @param {string} userId - The authenticated Supabase user ID.
   * @returns {Object} Normalized user object ready for React state.
   * @throws {Error} If the user_profiles fetch fails.
   */
  async fetchUserProfile(userId) {
    // 1. Fetch the user's base profile first (we need role_id from it)
    const { data: profile, error: pError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (pError) throw pError;

    // 2. Fetch role permissions, vertical access, and feature access in parallel
    const [
      { data: rolePerms },
      { data: vAccess },
      { data: fAccess },
    ] = await Promise.all([
      supabase.from('role_permissions').select('*').eq('role_id', profile.role_id).single(),
      supabase.from('vertical_access').select('*').eq('user_id', userId),
      supabase.from('feature_access').select('*').eq('user_id', userId),
    ]);

    // 3. Build vertical permissions map: { [vertical_id]: { level, features: {} } }
    const vPermsMap = {};
    (vAccess || []).forEach(v => {
      vPermsMap[v.vertical_id] = { level: v.access_level, features: {} };
    });

    // 4. Add feature-level access into the vertical map
    (fAccess || []).forEach(f => {
      if (vPermsMap[f.vertical_id]) {
        vPermsMap[f.vertical_id].features[f.feature_id] = f.access_level;
      }
    });

    // 5. Return normalized user object
    return {
      id: profile.id,
      name: profile.name || 'User',
      role: profile.role_id,
      roleId: profile.role_id,
      assignedVerticals: (vAccess || []).map(v => v.vertical_id),
      verticalPermissions: vPermsMap,
      baseCapabilities: rolePerms?.permissions || {},
    };
  },
};
