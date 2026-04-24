import React from 'react';
import './HubTaskTile.css';

/**
 * HubTaskTile
 * Custom metadata injected into the master TaskCard's 2nd Row.
 * Refactored for Multi-Hub & Hierarchy Support (Runbook 12).
 */
const HubTaskTile = ({ task }) => {
  return (
    <div className={`hub-tile-meta ${task.isSubTask ? 'subtask-indent' : ''}`}>
      
      {/* 1. Multi-Hub Badges */}
      <div className="task-hub-badges">
        {(task.hubCodes || []).map((code, i) => (
          <span key={i} className="hub-badge" title={task.hubNames?.[i] || code}>
            {code}
          </span>
        ))}
        {/* Fallback for legacy data */}
        {(task.hubCodes || []).length === 0 && task.hub_id && (
          <span className="hub-badge">📍 Hub</span>
        )}
      </div>

      {/* 2. Function Badge (If present) */}
      {task.function && (
        <span className="tile-function-badge halo-type" title={`Function: ${task.function}`}>
          {task.function}
        </span>
      )}
    </div>
  );
};

export default HubTaskTile;
