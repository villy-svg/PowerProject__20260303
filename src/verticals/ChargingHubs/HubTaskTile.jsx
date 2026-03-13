import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import './HubTaskTile.css';

/**
 * HubTaskTile
 * Custom 1st-row tile for Charging Hub tasks.
 * Displays: Name, Hub Code, and clickable Stage badge.
 */
const HubTaskTile = ({ 
  task, 
  stage, 
  canUpdate, 
  canDelete, 
  updateTaskStage, 
  deleteTask,
  STAGE_LIST 
}) => {
  const [hubCode, setHubCode] = useState('...');

  useEffect(() => {
    if (task.hub_id) {
      fetchHubCode();
    } else {
      setHubCode('Global');
    }
  }, [task.hub_id]);

  const fetchHubCode = async () => {
    const { data } = await supabase
      .from('hubs')
      .select('hub_code')
      .eq('id', task.hub_id)
      .single();
    if (data) setHubCode(data.hub_code);
  };

  return (
    <div className="hub-task-tile" style={{ borderLeft: `4px solid ${stage.color}` }}>
      <div className="tile-main-info">
        <span className="tile-task-name" title={task.text}>{task.text}</span>
        <span className="tile-hub-code">{hubCode}</span>
      </div>

      <div className="tile-actions">
        {canUpdate && (
          <select 
            className="tile-stage-select"
            value={task.stageId}
            style={{ color: stage.color, borderColor: `${stage.color}44` }}
            onChange={(e) => updateTaskStage(task.id, e.target.value)}
          >
            {STAGE_LIST.map(s => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        )}

        {canDelete && (
          <button 
            className="tile-delete-btn"
            onClick={() => deleteTask(task.id)}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default HubTaskTile;
