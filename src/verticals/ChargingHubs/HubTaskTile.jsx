import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import './HubTaskTile.css';

/**
 * HubTaskTile
 * Custom metadata injected into the master TaskCard's 2nd Row.
 * Displays: Hub Code badge.
 */
const HubTaskTile = ({ task }) => {
  const [hubCode, setHubCode] = useState('...');

  useEffect(() => {
    if (task.hub_id) {
      fetchHubCode();
    } else {
      setHubCode('N/A');
    }
  }, [task.hub_id]);

  const fetchHubCode = async () => {
    try {
      const { data, error } = await supabase
        .from('hubs')
        .select('hub_code')
        .eq('id', task.hub_id)
        .single();
      
      if (error || !data) {
        setHubCode('N/A');
      } else {
        setHubCode(data.hub_code);
      }
    } catch (err) {
      setHubCode('N/A');
    }
  };

  return (
    <span className="tile-hub-code halo-type">{hubCode}</span>
  );
};

export default HubTaskTile;
