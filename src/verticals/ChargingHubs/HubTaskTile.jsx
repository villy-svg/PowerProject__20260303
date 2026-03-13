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
  openEditModal,
  STAGE_LIST 
}) => {
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

  const handleMove = (direction) => {
    const currentIndex = STAGE_LIST.findIndex(s => s.id === task.stageId);
    let newIndex = currentIndex;

    if (direction === 'left' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else if (direction === 'right' && currentIndex < STAGE_LIST.length - 1) {
      newIndex = currentIndex + 1;
    }

    if (newIndex !== currentIndex) {
      updateTaskStage(task.id, STAGE_LIST[newIndex].id);
    }
  };

  const currentIndex = STAGE_LIST.findIndex(s => s.id === task.stageId);
  const canMoveLeft = currentIndex > 0;
  const canMoveRight = currentIndex < STAGE_LIST.length - 1;

  return (
    <div className="hub-task-tile" style={{ borderLeft: `4px solid ${stage.color}` }}>
      <div className="tile-row-1">
        <span className="tile-task-name" title={task.text}>{task.text}</span>
      </div>

      <div className="tile-row-2">
        <div className="tile-left">
          <span className="tile-hub-code halo-type">{hubCode}</span>
          {task.priority && (
            <span className={`tile-priority priority-${task.priority.toLowerCase()}`}>
              {task.priority}
            </span>
          )}
        </div>

        <div className="tile-right">
          <div className="tile-navigation">
            {canUpdate && (
              <>
                <button 
                  className={`nav-arrow ${!canMoveLeft ? 'disabled' : ''}`}
                  onClick={() => handleMove('left')}
                  disabled={!canMoveLeft}
                  title="Move Back"
                >
                  ←
                </button>
                <button 
                  className={`nav-arrow ${!canMoveRight ? 'disabled' : ''}`}
                  onClick={() => handleMove('right')}
                  disabled={!canMoveRight}
                  title="Move Forward"
                >
                  →
                </button>
              </>
            )}
          </div>

          <div className="tile-actions-group">
            {canUpdate && (
              <button 
                className="tile-edit-btn" 
                onClick={() => openEditModal(task)}
                title="Edit Task"
              >
                ✎
              </button>
            )}

            {canDelete && (
              <button 
                className="tile-delete-btn"
                onClick={() => deleteTask(task.id)}
                title="Delete Task"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HubTaskTile;
