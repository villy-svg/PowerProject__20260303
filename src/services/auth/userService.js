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
          name,
          email,
          status,
          role_id
        )
      `)
      .order('name');

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
   */
  async syncPermissions({ userId, roleId, verticalGrants, featureGrants }) {
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
      p_f_access: fAccess
    });

    if (error) throw error;
    return { success: true };
  }
};
