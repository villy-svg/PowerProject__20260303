import { useState, useEffect } from 'react';
import { fetchActiveHubs } from '../../../../services/employees/attendanceService';

export function useHubs() {
  const [hubs, setHubs] = useState([]);
  const [isLoadingHubs, setIsLoadingHubs] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingHubs(true);

    // Delegated to attendanceService.js (development-best-practices §10: zero raw fetching in hooks)
    fetchActiveHubs().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        setHubs([]);
      } else {
        setHubs(data || []);
      }
      setIsLoadingHubs(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return { hubs, isLoadingHubs };
}
