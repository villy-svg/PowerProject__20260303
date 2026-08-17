import React from 'react';

/**
 * EmployeeTaskTile
 * Custom metadata injected into the master TaskCard for the Employee Manager.
 */
const EmployeeTaskTile = ({ task }) => {
  if (!task.city && !task.function) return null;

  return (
    <div className="hub-tile-meta">
      {task.city && (
        <span
          className="tile-hub-code halo-type"
          title={`Department: ${task.city}`}
        >
          {task.city}
        </span>
      )}
      {task.function && (
        <span
          className="tile-function-badge halo-type"
          title={`Role: ${task.function}`}
        >
          {task.function}
        </span>
      )}
    </div>
  );
};

export default EmployeeTaskTile;
