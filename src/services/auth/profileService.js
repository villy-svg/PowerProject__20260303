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
    // 1. Fetch the user's base profile (using maybeSingle to avoid crash)
    let { data: profile, error: pError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (pError) throw pError;

    // If profile is missing after auth, the DB trigger should have created it.
    // This guards against a race condition or trigger failure.
    if (!profile) {
      throw new Error("Your profile could not be loaded. Please sign out and sign back in.");
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
    
    // 5. SELF-HEALING: If employee_id is missing, try to link by email
    let effectiveEmployeeId = profile.employee_id;
    if (!effectiveEmployeeId && profile.email) {
      const { data: matchedEmp } = await supabase
        .from('employees')
        .select('id')
        .eq('email', profile.email)
        .eq('status', 'Active')
        .maybeSingle();
      
      if (matchedEmp) {
        effectiveEmployeeId = matchedEmp.id;
        // Persist the link for next time
        const { error: healError } = await supabase
          .from('user_profiles')
          .update({ employee_id: effectiveEmployeeId })
          .eq('id', userId);
        
        if (healError) {
          console.error(`FAILED self-heal for user ${userId}:`, healError.message);
        } else {
          console.log(`Self-healed employee link for user ${userId} -> ${effectiveEmployeeId}`);
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
          .single(),
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
