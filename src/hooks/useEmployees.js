import { useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

/**
 * useEmployees Hook
 * Encapsulates all data fetching and mutation logic for employee records.
 * Located in global hooks to allow cross-vertical access (e.g., Task Assignments).
 */
export const useEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      // Robust Fetch: Separate requests for data + metadata to avoid fragile joins/400 errors
      const [{ data: emps, error: empErr }, { data: hubs }, { data: roles }, { data: depts }] = await Promise.all([
        supabase.from('employees').select('*').order('full_name', { ascending: true }),
        supabase.from('hubs').select('id, hub_code'),
        supabase.from('employee_roles').select('id, role_code'),
        supabase.from('departments').select('id, dept_code')
      ]);

      if (empErr) throw empErr;

      // Efficient ID Mapping
      const hubMap = new Map((hubs || []).map(h => [h.id, h.hub_code]));
      const roleMap = new Map((roles || []).map(r => [r.id, r.role_code]));
      const deptMap = new Map((depts || []).map(d => [d.id, d.dept_code]));

      const processed = (emps || []).map(emp => ({
        ...emp,
        hub_code: hubMap.get(emp.hub_id) || 'NO HUB',
        role_code: roleMap.get(emp.role_id) || 'NO ROLE',
        dept_code: deptMap.get(emp.department_id) || 'NO DEPT'
      }));

      setEmployees(processed);
    } catch (error) {
      console.error('Error fetching employees:', error);
      // Absolute fallback to simple list
      const { data } = await supabase.from('employees').select('*').order('full_name');
      setEmployees(data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const addEmployee = async (formData) => {
    const employeeData = {
      full_name: formData.name,
      phone: formData.contactNumber,
      email: formData.emailId || null,
      gender: formData.gender,
      dob: formData.dob,
      hire_date: formData.doj || null,
      hub_id: (formData.hub_id === 'ALL' || !formData.hub_id) ? null : formData.hub_id,
      role_id: formData.role_id || null,
      department_id: formData.department_id || null,
      account_number: formData.accountNumber,
      ifsc_code: formData.ifscCode,
      account_name: formData.accountName,
      status: 'Active',
      updated_at: new Date().toISOString()
    };

    console.log('useEmployees: Attempting to insert:', employeeData);

    const { data, error } = await supabase.from('employees').insert([employeeData]).select();
    
    if (error) {
      console.error('useEmployees: Insert Error:', error);
      throw error;
    }
    console.log('useEmployees: Insert Success:', data);
    await fetchEmployees();
  };

  const updateEmployee = async (id, formData) => {
    const updateData = {
      full_name: formData.name,
      phone: formData.contactNumber,
      email: formData.emailId || null,
      gender: formData.gender,
      dob: formData.dob,
      hire_date: formData.doj || null,
      hub_id: (formData.hub_id === 'ALL' || !formData.hub_id) ? null : formData.hub_id,
      role_id: formData.role_id || null,
      department_id: formData.department_id || null,
      account_number: formData.accountNumber,
      ifsc_code: formData.ifscCode,
      account_name: formData.accountName,
      updated_at: new Date().toISOString()
    };

    console.log(`useEmployees: Attempting to update ${id}:`, updateData);

    const { data, error } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('useEmployees: Update Error:', error);
      throw error;
    }
    console.log('useEmployees: Update Success:', data);
    await fetchEmployees();
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

    // Optimistic UI update
    setEmployees(prev => prev.map(emp =>
      emp.id === id ? { ...emp, status: newStatus } : emp
    ));

    const { error } = await supabase
      .from('employees')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error(`Status update failed: ${error.message}`);
      await fetchEmployees(); // Revert on failure
      throw error;
    }
  };

  const deleteEmployee = async (id) => {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) throw error;
    setEmployees(prev => prev.filter(emp => emp.id !== id));
  };

  return {
    employees,
    loading,
    fetchEmployees,
    addEmployee,
    updateEmployee,
    toggleStatus,
    deleteEmployee
  };
};
