import { useState, useCallback } from 'react';
import { employeeService } from '../services/employees/employeeService';
import { masterErrorHandler } from '../services/core/masterErrorHandler';

/**
 * useEmployees Hook
 * Manages employee state and delegates all DB operations to employeeService.
 * Located in global hooks to allow cross-vertical access (e.g., Task Assignments).
 */
export const useEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [loading, setLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // READ
  // ---------------------------------------------------------------------------

  const fetchEmployees = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const { employees: resolved, hubs: hubList } = await employeeService.getEmployees();
      
      // Fetch users to map App Access status
      const { data: usersData } = await (await import('../services/core/supabaseClient')).supabase
        .from('user_profiles').select('id, email');

      const finalEmployees = resolved.map(emp => {
        const matchingUser = (usersData || []).find(u => u.email && emp.email && u.email.toLowerCase() === emp.email.toLowerCase());
        return { ...emp, is_app_user: !!matchingUser, app_user_id: matchingUser?.id };
      });

      setEmployees(finalEmployees);
      setHubs(hubList);
    } catch (error) {
      masterErrorHandler.handleDatabaseError(error, 'useEmployees.fetchEmployees');
      // Graceful fallback: refetch without joins on total failure
      try {
        const { data } = await (await import('../services/core/supabaseClient')).supabase
          .from('employees').select('*').order('full_name');
        setEmployees(data || []);
      } catch (_) { /* swallow fallback error */ }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  const addEmployee = async (formData) => {
    try {
      await employeeService.addEmployee(formData);
      await fetchEmployees(false);
    } catch (error) {
      masterErrorHandler.handleDatabaseError(error, 'useEmployees.addEmployee');
      throw error;
    }
  };

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  const updateEmployee = async (id, formData) => {
    try {
      await employeeService.updateEmployee(id, formData);
      await fetchEmployees(false);
    } catch (error) {
      masterErrorHandler.handleDatabaseError(error, 'useEmployees.updateEmployee');
      throw error;
    }
  };

  const updateEmployeeHub = async (id, newHubId) => {
    // Optimistic UI update
    setEmployees(prev => prev.map(emp => {
      if (emp.id !== id) return emp;
      const hubCode = (newHubId === 'ALL' || !newHubId)
        ? 'ALL'
        : (hubs.find(h => h.id === newHubId)?.hub_code || 'NO HUB');
      return { ...emp, hub_id: (newHubId === 'ALL' || !newHubId) ? null : newHubId, hub_code: hubCode };
    }));

    try {
      await employeeService.updateEmployeeHub(id, newHubId);
      await fetchEmployees(false);
    } catch (error) {
      masterErrorHandler.handleDatabaseError(error, 'useEmployees.updateEmployeeHub');
      await fetchEmployees(false); // Revert on failure
      throw error;
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    // Optimistic UI update
    const optimisticStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setEmployees(prev => prev.map(emp => emp.id === id ? { ...emp, status: optimisticStatus } : emp));

    try {
      await employeeService.toggleStatus(id, currentStatus);
    } catch (error) {
      masterErrorHandler.handleDatabaseError(error, 'useEmployees.toggleStatus');
      await fetchEmployees(false); // Revert
      throw error;
    }
  };

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  const deleteEmployee = async (id) => {
    try {
      await employeeService.deleteEmployee(id);
      setEmployees(prev => prev.filter(emp => emp.id !== id));
    } catch (error) {
      masterErrorHandler.handleDatabaseError(error, 'useEmployees.deleteEmployee');
      throw error;
    }
  };

  const bulkUpdateEmployees = async (ids, updates) => {
    try {
      setLoading(true);
      await employeeService.bulkUpdateEmployees(ids, updates);
      await fetchEmployees(false);
    } catch (error) {
      masterErrorHandler.handleDatabaseError(error, 'useEmployees.bulkUpdateEmployees');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------

  return {
    employees,
    hubs,
    loading,
    fetchEmployees,
    addEmployee,
    updateEmployee,
    updateEmployeeHub,
    toggleStatus,
    deleteEmployee,
    bulkUpdateEmployees,
  };
};
