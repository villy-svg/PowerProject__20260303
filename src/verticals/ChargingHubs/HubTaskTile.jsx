import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import './HubTaskTile.css';

// Module-level cache to avoid redundant fetches across hundreds of tiles
let functionsCache = null;

/**
 * HubTaskTile
 * Custom metadata injected into the master TaskCard's 2nd Row.
 */
const HubTaskTile = ({ task }) => {
  const [functions, setFunctions] = useState(functionsCache);

  useEffect(() => {
    if (functionsCache) return;
    
    const loadFunctions = async () => {
      const { data } = await supabase.from('hub_functions').select('name, function_code');
      if (data) {
        functionsCache = data;
        setFunctions(data);
      }
    };
    loadFunctions();
  }, []);

  const isMulti = !task.isSubTask && (task.hubCodes || []).length > 1;
  
  // Resolve function code from name
  const functionCode = functions?.find(f => f.name === task.function)?.function_code || task.function;

  return (
    <div className={`hub-tile-meta ${task.isSubTask ? 'subtask-indent' : ''}`}>
      
      {/* 1. Hub Badges */}
      <div className="task-hub-badges">
        {isMulti ? (
          <span className="hub-badge multi-badge" title={task.hubCodes.join(', ')}>
            MULTI
          </span>
        ) : (
          (task.hubCodes || []).map((code, i) => (
            <span key={i} className="hub-badge" title={task.hubNames?.[i] || code}>
              {code}
            </span>
          ))
        )}
        {/* Fallback for legacy data */}
        {(task.hubCodes || []).length === 0 && task.hub_id && (
          <span className="hub-badge">📍 Hub</span>
        )}
      </div>

      {/* 2. Function Badge (If present) */}
      {task.function && (
        <span className="tile-function-badge halo-type" title={`Function: ${task.function}`}>
          {functionCode}
        </span>
      )}
    </div>
  );
};

export default HubTaskTile;
