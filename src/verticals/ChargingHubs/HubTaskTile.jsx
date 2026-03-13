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
  const [functionCode, setFunctionCode] = useState('');

  useEffect(() => {
    if (task.hub_id) {
      fetchHubCode();
    } else {
      setHubCode('N/A');
    }

    if (task.function) {
      fetchFunctionCode();
    } else {
      setFunctionCode('');
    }
  }, [task.hub_id, task.function]);

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

  const fetchFunctionCode = async () => {
    try {
      const { data, error } = await supabase
        .from('hub_functions')
        .select('function_code')
        .eq('name', task.function)
        .single();
      
      if (!error && data?.function_code) {
        setFunctionCode(data.function_code);
      } else {
        // Fallback to name if code is missing or error
        setFunctionCode(task.function);
      }
    } catch (err) {
      setFunctionCode(task.function);
    }
  };

  return (
    <div className="hub-tile-meta">
      <span className="tile-hub-code halo-type" title={`Hub: ${hubCode}`}>
        {hubCode}
      </span>
      {task.function && (
        <span className="tile-function-badge halo-type" title={`Function: ${task.function}`}>
          {functionCode || task.function}
        </span>
      )}
    </div>
  );
};

export default HubTaskTile;
