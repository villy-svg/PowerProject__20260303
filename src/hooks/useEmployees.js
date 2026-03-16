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
    const { data, error } = await supabase
      .from('employees')
      .select(`
        *,
        hubs (hub_code),
        employee_roles!employees_role_fkey (role_code),
        departments!employees_department_fkey (dept_code)
      `)
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching employees:', error);
      // Fallback to simple select if join fails to prevent blank screen
      const { data: simpleData } = await supabase.from('employees').select('*').order('full_name');
      setEmployees(simpleData || []);
    } else {
      // Flatten the joined data for components (handle potential array or object return)
      const flattened = (data || []).map(emp => {
        const h = Array.isArray(emp.hubs) ? emp.hubs[0] : emp.hubs;
        const r = Array.isArray(emp.employee_roles) ? emp.employee_roles[0] : emp.employee_roles;
        const d = Array.isArray(emp.departments) ? emp.departments[0] : emp.departments;

        return {
          ...emp,
          hub_code: h?.hub_code || null,
          role_code: r?.role_code || null,
          dept_code: d?.dept_code || null
        };
      });
      setEmployees(flattened);
    }
    setLoading(false);
  }, []);

  const addEmployee = async (formData) => {
    const employeeData = {
      full_name: formData.name,
      phone: formData.contactNumber,
      email: formData.emailId || null,
      gender: formData.gender,
      dob: formData.dob,
      hire_date: formData.doj || null,
      hub_id: formData.hub_id || null,
      role_id: formData.role_id || null,
      department_id: formData.department_id || null,
      account_number: formData.accountNumber,
      ifsc_code: formData.ifscCode,
      account_name: formData.accountName,
      status: 'Active',
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('employees').insert([employeeData]);
    if (error) throw error;
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
      hub_id: formData.hub_id || null,
      role_id: formData.role_id || null,
      department_id: formData.department_id || null,
      account_number: formData.accountNumber,
      ifsc_code: formData.ifscCode,
      account_name: formData.accountName,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
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
