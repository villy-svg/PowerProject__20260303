/**
 * Employee Service
 * Stateless service for all Supabase operations related to employees and their
 * linked lookup tables (hubs, roles, departments).
 * Canonical location: src/services/employees/employeeService.js
 *
 * Consuming hook: src/hooks/useEmployees.js
 */
import { supabase } from '../core/supabaseClient';
import { generateEmpCode, calculateBadgeId, logEmployeeHistory } from '../../utils/employeeUtils';

// ---------------------------------------------------------------------------
// Internal Utilities
// ---------------------------------------------------------------------------

/**
 * Resolve lookup IDs to human-readable codes for display.
 * @param {Object[]} employees - Raw employee rows from Supabase.
 * @param {Map} hubMap   - id -> hub_code
 * @param {Map} roleMap  - id -> { role_code, seniority_level }
 * @param {Map} deptMap  - id -> dept_code
 */
const resolveEmployeeCodes = (employees, hubMap, roleMap, deptMap) => {
  const empMap = new Map(employees.map(e => [e.id, e.full_name]));
  
  return employees.map(emp => ({
    ...emp,
    hub_code: emp.hub_id ? (hubMap.get(emp.hub_id) || 'NO HUB') : 'NULL',
    role_code: roleMap.get(emp.role_id)?.role_code || 'NO ROLE',
    seniority_level: roleMap.get(emp.role_id)?.seniority_level || 1,
    dept_code: deptMap.get(emp.department_id) || 'NO DEPT',
    manager_name: emp.manager_id ? (empMap.get(emp.manager_id) || 'Unknown') : 'None',
  }));
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const employeeService = {
  /**
   * Fetch all employees and their linked lookup tables in parallel.
   * Returns both the resolved employee list and raw lookup data.
   * @returns {{ employees: Object[], hubs: Object[] }}
   */
  async getEmployees() {
    const [
      { data: emps, error: empErr },
      { data: hubsData },
      { data: roles },
      { data: depts },
    ] = await Promise.all([
      supabase.from('employees').select('*, user_profiles(id)').order('full_name', { ascending: true }),
      supabase.from('hubs').select('id, hub_code').order('hub_code'),
      supabase.from('employee_roles').select('id, role_code, seniority_level'),
      supabase.from('departments').select('id, dept_code'),
    ]);

    if (empErr) throw empErr;

    const hubMap  = new Map((hubsData || []).map(h => [h.id, h.hub_code]));
    const roleMap = new Map((roles    || []).map(r => [r.id, { role_code: r.role_code, seniority_level: r.seniority_level }]));
    const deptMap = new Map((depts    || []).map(d => [d.id, d.dept_code]));

    // Flatten user_profiles(id) to user_id
    const processedEmps = (emps || []).map(e => ({
      ...e,
      user_id: e.user_profiles?.[0]?.id || e.user_profiles?.id || null
    }));

    return {
      employees: resolveEmployeeCodes(processedEmps, hubMap, roleMap, deptMap),
      hubs: hubsData || [],
    };
  },

  /**
   * Insert a new employee record.
   * @param {Object} formData - Form values from EmployeeForm.
   * @returns {Object} The newly created employee row.
   */
  async addEmployee(formData) {
    const empCode = generateEmpCode();
    const badgeId = await calculateBadgeId(formData, formData.doj);

    const row = {
      full_name: formData.name,
      phone: formData.contactNumber,
      email: formData.emailId || null,
      gender: formData.gender,
      dob: formData.dob,
      hire_date: formData.doj || null,
      hub_id: (formData.hub_id === 'ALL' || !formData.hub_id) ? null : formData.hub_id,
      role_id: formData.role_id || null,
      department_id: formData.department_id || null,
      manager_id: formData.manager_id || null,
      account_number: formData.accountNumber,
      ifsc_code: formData.ifscCode,
      account_name: formData.accountName,
      pan_number: formData.panNumber || null,
      status: 'Active',
      emp_code: empCode,
      badge_id: badgeId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('employees').insert([row]).select();
    if (error) throw error;

    if (data?.[0]) {
      await logEmployeeHistory(data[0].id, data[0], 'INSERT');
    }

    return data[0];
  },

  /**
   * Full update of an employee record. Re-generates badge ID if role or dept changed.
   * @param {string} id
   * @param {Object} formData
   * @returns {Object} The updated employee row.
   */
  async updateEmployee(id, formData) {
    const { data: current } = await supabase
      .from('employees')
      .select('role_id, department_id, badge_id, emp_code, hire_date')
      .eq('id', id)
      .single();

    let badgeId = current?.badge_id;
    if (current && (current.role_id !== formData.role_id || current.department_id !== formData.department_id)) {
      badgeId = await calculateBadgeId(formData, current.hire_date);
    }

    const row = {
      full_name: formData.name,
      phone: formData.contactNumber,
      email: formData.emailId || null,
      gender: formData.gender,
      dob: formData.dob,
      hire_date: formData.doj || null,
      hub_id: (formData.hub_id === 'ALL' || !formData.hub_id) ? null : formData.hub_id,
      role_id: formData.role_id || null,
      department_id: formData.department_id || null,
      manager_id: formData.manager_id || null,
      account_number: formData.accountNumber,
      ifsc_code: formData.ifscCode,
      account_name: formData.accountName,
      pan_number: formData.panNumber || null,
      badge_id: badgeId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('employees').update(row).eq('id', id).select();
    if (error) throw error;

    if (data?.[0]) {
      await logEmployeeHistory(id, data[0], 'UPDATE');
    }

    return data[0];
  },

  /**
   * Update only the hub assignment for an employee.
   * @param {string} id
   * @param {string|null} newHubId
   * @returns {Object} The updated employee row.
   */
  async updateEmployeeHub(id, newHubId) {
    const row = {
      hub_id: (newHubId === 'ALL' || !newHubId) ? null : newHubId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('employees').update(row).eq('id', id).select();
    if (error) throw error;

    if (data?.[0]) {
      await logEmployeeHistory(id, data[0], 'UPDATE_HUB');
    }

    return data[0];
  },

  /**
   * Toggle an employee's active/inactive status.
   * @param {string} id
   * @param {'Active'|'Inactive'} currentStatus
   */
  async toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    
    // HIERARCHY REPAIR: If inactivating an employee, move their reportees up the tree
    if (newStatus === 'Inactive') {
      try {
        // 1. Get the current manager of the person being inactivated
        const { data: emp, error: fetchErr } = await supabase
          .from('employees')
          .select('manager_id, full_name')
          .eq('id', id)
          .single();
        
        if (emp) {
          const newManagerId = emp.manager_id || null;
          
          // 2. Identify and reassign all direct reportees
          const { data: reportees, error: repErr } = await supabase
            .from('employees')
            .update({ manager_id: newManagerId, updated_at: new Date().toISOString() })
            .eq('manager_id', id)
            .select('id, full_name');
          
          if (repErr) {
            console.error(`[HierarchyRepair] Failed to reassign reportees for ${emp.full_name}:`, repErr);
          } else if (reportees && reportees.length > 0) {
            console.log(`[HierarchyRepair] Reassigned ${reportees.length} reportees of ${emp.full_name} to manager ${newManagerId || 'None (Root)'}`);
            // Log history for each reassigned reportee
            for (const rep of reportees) {
              await logEmployeeHistory(rep.id, { ...rep, manager_id: newManagerId }, 'HIERARCHY_REPAIR_INACTIVATION');
            }
          }
        }
      } catch (err) {
        console.error('[HierarchyRepair] Critical logical error during inactivation:', err);
      }
    }

    const { error } = await supabase
      .from('employees')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return newStatus;
  },

  /**
   * Permanently delete an employee record.
   * @param {string} id
   */
  async deleteEmployee(id) {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Bulk update multiple employee records.
   * @param {string[]} ids - Array of employee IDs to update.
   * @param {Object} updates - Object containing fields to update.
   */
  async bulkUpdateEmployees(ids, updates) {
    if (!ids || ids.length === 0) return;
    
    const row = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('employees')
      .update(row)
      .in('id', ids)
      .select();

    if (error) throw error;

    // Log history for each updated employee
    if (data) {
      for (const emp of data) {
        await logEmployeeHistory(emp.id, emp, 'BULK_UPDATE');
      }
    }
    return data;
  },
};
