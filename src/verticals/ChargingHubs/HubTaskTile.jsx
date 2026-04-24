import React from 'react';
import './HubTaskTile.css';

/**
 * HubTaskTile
 * Custom metadata injected into the master TaskCard's 2nd Row.
 * Refactored for Multi-Hub & Hierarchy Support (Runbook 12).
 */
const HubTaskTile = ({ task, isExpanded, toggleExpanded }) => {
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

      {/* 2. Hierarchy Controls */}
      <div className="task-hierarchy-visuals">
        {/* Parent Expansion Toggle */}
        {task.childCount > 0 && (
          <div 
            className={`parent-task-badge ${isExpanded ? 'expanded' : ''}`} 
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(task.id);
            }}
          >
            <span className="child-count-icon">
              {isExpanded ? '▼' : '▶'}
            </span>
            <span className="child-count-text">
              {task.childCount} sub-tasks
            </span>
          </div>
        )}

        {/* Sub-task Indicator */}
        {task.isSubTask && (
          <div className="subtask-indicator">
            ↳ <span className="parent-ref">Sub-task</span>
          </div>
        )}
      </div>

      {/* 3. Function Badge (If present) */}
      {task.function && (
        <span className="tile-function-badge halo-type" title={`Function: ${task.function}`}>
          {task.function}
        </span>
      )}
    </div>
  );
};

export default HubTaskTile;
