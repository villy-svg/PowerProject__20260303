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
import { hierarchyUtils } from '../../utils/hierarchyUtils';
import { MANAGER_SENIORITY_THRESHOLD } from '../../constants/roles';

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
    // -------------------------------------------------------------------------
    // OFFLINE BYPASS: Provide mock profile from cache or template.
    // -------------------------------------------------------------------------
    if (import.meta.env.DEV && userId === 'dev-bypass-user-id') {
      const cached = localStorage.getItem('power_project_user');
      if (cached) {
        try {
          const user = JSON.parse(cached);
          console.warn('PowerProject: Using cached user profile for bypass.');
          return user;
        } catch (e) { console.error('Cache Parse Error:', e); }
      }
      
      console.warn('PowerProject: No cached profile found. Using Master Admin template.');
      return {
        id: userId,
        name: 'Dev Admin (Offline)',
        email: 'dev@powerpod.in',
        roleId: 'master_admin',
        seniority: 10,
        assignedVerticals: ['charging_hubs', 'employees', 'clients'],
        verticalPermissions: {
          charging_hubs: { level: 'admin', features: {} },
          employees: { level: 'admin', features: {} },
          clients: { level: 'admin', features: {} }
        },
        baseCapabilities: { 
          canCreate: true, canRead: true, canUpdate: true, canDelete: true, 
          canAccessConfig: true, canManageRoles: true 
        }
      };
    }

    // 1. Fetch the user's base profile (using maybeSingle to avoid crash)
    let { data: profile, error: pError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (pError) throw pError;

    // FALLBACK: If the trigger failed silently, profile may be missing.
    if (!profile) {
      console.warn(`Profile missing for user ${userId} — trigger may have failed. Attempting recovery.`);
      const { data: newUser } = await supabase.auth.getUser();
      const user = newUser?.user;

      // 1. Check if profile exists under a different casing or orphaned email
      const { data: existingByEmail } = await supabase
        .from('user_profiles')
        .select('id')
        .ilike('email', user?.email)
        .maybeSingle();

      const { data: recovered, error: upsertError } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          email: user?.email,
          name: user?.user_metadata?.name || user?.email?.split('@')[0] || 'User',
          role_id: 'vertical_viewer'
        })
        .select()
        .single();

      if (upsertError) {
        console.error('Profile recovery failed:', upsertError.message);
        throw new Error('Your profile could not be loaded. Please sign out and sign back in.');
      }
      profile = recovered;
    }

    // 2. Fetch role permissions, vertical access, and feature access in parallel
    const [
      { data: rolePerms },
      { data: vAccess },
      { data: fAccess },
    ] = await Promise.all([
      supabase.from('role_permissions').select('*').eq('role_id', profile.role_id).maybeSingle(),
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

    // 5. Fetch linked employee and their seniority (over-and-above RBAC)
    let employeeData = null;
    let seniority = 100; // Default high seniority
    let reporteeUserIds = [];
    let reporteeEmployeeIds = [];
    
    // 5. SELF-HEALING FALLBACK: If employee_id still missing, try to link by email.
    // This handles the edge case where an employee record was created AFTER the user registered.
    // The trigger handles the common case (employee exists at registration time).
    let effectiveEmployeeId = profile.employee_id;
    if (!effectiveEmployeeId && profile.email) {
      const { data: matchedEmp } = await supabase
        .from('employees')
        .select('id')
        .ilike('email', profile.email) // Use .ilike for case-insensitive matching
        .eq('status', 'Active')
        .maybeSingle();

      if (matchedEmp) {
        effectiveEmployeeId = matchedEmp.id;
        // Persist the link — trigger missed this because employee was created after registration
        const { error: healError } = await supabase
          .from('user_profiles')
          .update({ employee_id: effectiveEmployeeId })
          .eq('id', userId);

        if (healError) {
          console.warn(`Could not persist employee link for user ${userId}:`, healError.message);
        } else {
          console.log(`Employee link established post-registration for user ${userId}`);
        }
      }
    }

    if (effectiveEmployeeId) {
      // 5b. Fetch employee, their role seniority, and the full list of employees for the tree in parallel
      const [empResult, allEmpsResult] = await Promise.all([
        supabase
          .from('employees')
          .select('id, role_id, employee_roles(seniority_level)')
          .eq('id', effectiveEmployeeId)
          .maybeSingle(), // Use maybeSingle to prevent PGRST116 crash if record is missing
        supabase.from('employees').select('id, manager_id')
      ]);

      const emp = empResult.data;
      const allEmps = allEmpsResult.data;

      if (emp) {
        employeeData = emp;
        seniority = emp.employee_roles?.seniority_level || 1;

        // FETCH REPORTING TREE for all users (ensures reporteeUserIds populated for both managers and assignees)
        if (allEmps) {
          const descendants = hierarchyUtils.getDescendants(allEmps, emp.id, 'id', 'manager_id');
          const treeEmployeeIds = [emp.id, ...descendants.map(d => d.id)];
          
          // Map Employee IDs to User IDs (Auth IDs) via user_profiles
          const { data: treeProfiles } = await supabase
            .from('user_profiles')
            .select('id, employee_id')
            .in('employee_id', treeEmployeeIds);

          if (treeProfiles) {
            reporteeEmployeeIds = treeEmployeeIds;
            reporteeUserIds = treeProfiles.map(p => p.id);
          }
        }
      }
    }

    // 6. Return normalized user object
    return {
      id: profile.id,
      name: profile.name || 'User',
      email: profile.email,
      role: profile.role_id,
      roleId: profile.role_id,
      employeeId: employeeData?.id || null,
      seniority: seniority,
      reporteeUserIds: reporteeUserIds,
      reporteeEmployeeIds: reporteeEmployeeIds,
      assignedVerticals: (vAccess || []).map(v => v.vertical_id),
      verticalPermissions: vPermsMap,
      baseCapabilities: rolePerms?.permissions || {},
    };
  },
};
