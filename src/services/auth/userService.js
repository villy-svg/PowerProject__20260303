import { supabase } from '../core/supabaseClient';

/**
 * User Service
 * Handles advanced administrative user management tasks.
 * Interacts with the sync_user_permissions RPC for atomic updates.
 */
export const userService = {
  /**
   * Fetches the full list of users with their basic profile and links.
   * Optimized for the UserManagement view.
   */
  async fetchUsers() {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        linkedEmployee:employees (
          id,
          full_name,
          emp_code,
          email,
          status,
          role_id,
          employee_roles (
            seniority_level
          )
        )
      `)
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Fetches detailed granular permissions for a specific user.
   */
  async fetchUserPermissions(userId) {
    const [vAccess, fAccess] = await Promise.all([
      supabase.from('vertical_access').select('*').eq('user_id', userId),
      supabase.from('feature_access').select('*').eq('user_id', userId)
    ]);

    return {
      verticals: vAccess.data || [],
      features: fAccess.data || []
    };
  },

  /**
   * Performs an ATOMIC sync of user permissions via the sync_user_permissions RPC.
   * Ensures either all tables update or none do.
   * Optionally pass isActive to also set the is_active flag atomically.
   */
  async syncPermissions({ userId, roleId, verticalGrants, featureGrants, isActive = true }) {
    // 1. Sanitize Data (Ensure 'none' levels aren't sent)
    const vAccess = verticalGrants
      .filter(v => v.access_level !== 'none')
      .map(v => ({ vertical_id: v.vertical_id, access_level: v.access_level }));

    const fAccess = featureGrants
      .filter(f => f.access_level !== 'none')
      .map(f => ({ 
        vertical_id: f.vertical_id, 
        feature_id: f.feature_id, 
        access_level: f.access_level 
      }));

    // 2. Call the RPC
    const { error } = await supabase.rpc('sync_user_permissions', {
      p_target_id: userId,
      p_role_id: roleId,
      p_v_access: vAccess,
      p_f_access: fAccess,
      p_is_active: isActive
    });

    if (error) throw error;
    return { success: true };
  },

  /**
   * Deactivates a user account.
   * Strips all vertical/feature access and sets role to vertical_viewer.
   * Master admin only — enforced server-side.
   * @param {string} userId - The user_profiles.id of the user to deactivate.
   */
  async deactivateUser(userId) {
    const { error } = await supabase.rpc('deactivate_user', {
      p_target_id: userId
    });
    if (error) throw error;
    return { success: true };
  },

  /**
   * Reactivates a previously deactivated user account.
   * Sets is_active = true; permissions remain at vertical_viewer.
   * The admin must manually re-grant access via the Permission Editor.
   * Master admin only — enforced server-side.
   * @param {string} userId - The user_profiles.id of the user to reactivate.
   */
  async reactivateUser(userId) {
    const { error } = await supabase.rpc('reactivate_user', {
      p_target_id: userId
    });
    if (error) throw error;
    return { success: true };
  },
};
