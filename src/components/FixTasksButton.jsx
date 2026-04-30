import React, { useState } from 'react';
import { taskService } from '../services/tasks/taskService';

/**
 * FixTasksButton Component
 * Available to Master Admins to repair task structural data.
 */
const FixTasksButton = ({ permissions, refreshTasks, className = '' }) => {
  const [fixingTasks, setFixingTasks] = useState(false);

  const handleFixTasks = async () => {
    setFixingTasks(true);
    try {
      const count = await taskService.fixAllTasks();
      alert(`Successfully analyzed and repaired ${count} tasks.`);
      if (refreshTasks) refreshTasks(false);
    } catch (err) {
      console.error('[FixTasksButton] Failed to fix tasks:', err);
      alert(`Failed to repair tasks: ${err.message || err}`);
    } finally {
      setFixingTasks(false);
    }
  };

  if (permissions?.roleId !== 'master_admin') {
    return null;
  }

  return (
    <button 
      className={`master-action-btn halo-button ${className}`}
      onClick={handleFixTasks} 
      disabled={fixingTasks}
      title="Fix missing or incorrect fields for all rows in the tasks table"
    >
      {fixingTasks ? 'Fixing...' : 'Fix Tasks'}
    </button>
  );
};

export default FixTasksButton;
