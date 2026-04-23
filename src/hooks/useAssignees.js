import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../services/core/supabaseClient';

/**
 * useAssignees Hook
 * Centralized hook to fetch active employees for assignment dropdowns.
 * Ensures consistent data fetching across all task forms and templates.
 */
export const useAssignees = (autoFetch = false) => {
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAssignees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('employees')
        .select('id, full_name, emp_code, email, badge_id, seniority_level')
        .eq('status', 'Active')
        .order('full_name');

      if (fetchError) throw fetchError;
      setAssignees(data || []);
    } catch (err) {
      console.error('Error fetching assignees:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchAssignees();
    }
  }, [autoFetch, fetchAssignees]);

  return { assignees, loading, error, fetchAssignees };
};
