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
            role_code,
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


  // ── User Admin Operations (Edge Function) ────────────────────────────────
  // These operations require the service-role key and use the `user-admin`
  // Edge Function as a secure proxy. The function verifies master_admin
  // on the server side — do not rely solely on UI guards.

  /**
   * Internal helper: invokes the user-admin Edge Function with a given action.
   * @private
   */
  async _userAdminAction(action, params = {}) {
    const { data, error } = await supabase.functions.invoke('user-admin', {
      body: { action, ...params },
    });
    if (error) throw error;
    if (data?.success === false) throw new Error(data.error || 'Unknown error from user-admin function');
    return data?.data ?? {};
  },

  /**
   * Creates a dummy @preset.local user for use as a Permission Preset template.
   * Master admin only — enforced server-side.
   * @param {string} name - Display name (e.g. "Preset: Junior Operator")
   */
  async createPresetUser(name) {
    return this._userAdminAction('create_preset', { name });
  },

  /**
   * Sends a Supabase magic-link invite email to a real employee.
   * Master admin only — enforced server-side.
   * @param {string} email
   * @param {string} [name]
   */
  async inviteUser(email, name) {
    return this._userAdminAction('invite_user', { email, name });
  },

  /**
   * Hard-deletes a user: purges all public-schema data then removes auth.users entry.
   * Use for preset cleanup or permanent account removal. Use deactivateUser() for soft locks.
   * Master admin only — enforced server-side.
   * @param {string} userId
   */
  async deleteUser(userId) {
    return this._userAdminAction('delete_user', { userId });
  },

  /**
   * Sends a password reset email to a real user account.
   * Master admin only — enforced server-side.
   * @param {string} email
   */
  async resetUserPassword(email) {
    return this._userAdminAction('reset_password', { email });
  },

  /**
   * Applies a Supabase-layer hard ban (invalidates all sessions immediately).
   * Complements the is_active soft-lock. Use for security incidents.
   * Master admin only — enforced server-side.
   * @param {string} userId
   */
  async banUser(userId) {
    return this._userAdminAction('ban_user', { userId });
  },

  /**
   * Lifts a Supabase-layer hard ban. Does NOT restore permissions.
   * Master admin only — enforced server-side.
   * @param {string} userId
   */
  async unbanUser(userId) {
    return this._userAdminAction('unban_user', { userId });
  },

  /**
   * Renames a preset profile's display name in user_profiles.
   * Master admin only — enforced server-side.
   * @param {string} userId
   * @param {string} newName
   */
  async renamePreset(userId, newName) {
    return this._userAdminAction('rename_preset', { userId, newName });
  },
};

