import { useState, useEffect } from 'react';
import { supabase } from '../../../../services/core/supabaseClient';

export function useHubs() {
  const [hubs, setHubs] = useState([]);
  const [isLoadingHubs, setIsLoadingHubs] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingHubs(true);
    
    supabase
      .from('hubs')
      .select('id, name, hub_code')
      .order('name')
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error('Error fetching hubs:', error);
          setHubs([]);
        } else if (data) {
          setHubs(data);
        }
        setIsLoadingHubs(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { hubs, isLoadingHubs };
}
