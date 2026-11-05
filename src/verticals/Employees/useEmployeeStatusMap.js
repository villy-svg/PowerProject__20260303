import { useEffect, useState } from 'react';
import { supabase } from '../../services/core/supabaseClient';

/**
 * useEmployeeStatusMap
 * Returns { [employeeId]: { name, isActive } } for ALL employees (active + inactive).
 * Only fetches when `enabled` is true.
 */
export const useEmployeeStatusMap = (enabled = true) => {
  const [statusMap, setStatusMap] = useState({});

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('employees').select('id, full_name, status');
      if (error || cancelled) {
        if (error) console.error('Error fetching employee statuses:', error);
        return;
      }
      const map = {};
      (data || []).forEach((e) => {
        map[e.id] = { name: e.full_name, isActive: String(e.status || '').toLowerCase() === 'active' };
      });
      setStatusMap(map);
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  return statusMap;
};
