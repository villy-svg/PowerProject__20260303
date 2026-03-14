import React from 'react';

/**
 * EmployeeTaskTile
 * Custom metadata injected into the master TaskCard for the Employee Manager.
 * Minimal for now — will be expanded with employee-specific fields based on user input.
 */
const EmployeeTaskTile = ({ task }) => {
  if (!task.description && !task.city) return null;

  return (
    <div className="hub-tile-meta" style={{ gap: '6px' }}>
      {task.city && (
        <span
          className="tile-hub-code halo-type"
          title={`Department: ${task.city}`}
          style={{ opacity: 0.8 }}
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
