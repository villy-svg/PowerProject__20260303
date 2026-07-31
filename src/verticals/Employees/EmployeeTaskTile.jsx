import React, { useState } from 'react';
import { useAuth } from '../../app/contexts/AuthContext';
import { taskService } from '../../services/tasks/taskService';
import { employeeService } from '../../services/employees/employeeService';
import { IconCheck, IconX } from '../../components/ui/Icons';

/**
 * EmployeeTaskTile
 * Custom metadata injected into the master TaskCard for the Employee Manager.
 */
const EmployeeTaskTile = ({ task }) => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  let payload = null;
  if (task.description) {
    try {
      payload = JSON.parse(task.description);
    } catch (e) {
      console.error("Failed to parse task payload:", e);
    }
  }



  if (!task.description && !task.city) return null;

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
