import React, { useState } from 'react';
import { taskService } from '../../services/tasks/taskService';

/**
 * ArchiveTasksButton Component
 * Available to Master Admins to manually trigger the warm archival process.
 */
const ArchiveTasksButton = ({ permissions, refreshTasks, className = '', label }) => {
  const [archivingTasks, setArchivingTasks] = useState(false);

  const handleArchiveTasks = async () => {
    setArchivingTasks(true);
    try {
      const result = await taskService.archiveOldTasks();
      alert(`Successfully archived ${result.tasks_moved} tasks, ${result.submissions_moved} submissions, and ${result.links_moved} links.`);
      if (refreshTasks) refreshTasks(false);
    } catch (err) {
      console.error('[ArchiveTasksButton] Failed to archive tasks:', err);
      alert(`Failed to archive tasks: ${err.message || err}`);
    } finally {
      setArchivingTasks(false);
    }
  };

  if (permissions?.roleId !== 'master_admin') {
    return null;
  }

  return (
    <button 
      className={`master-action-btn halo-button ${className}`}
      onClick={handleArchiveTasks} 
      disabled={archivingTasks}
      title="Manually archive old completed and deprioritized tasks"
    >
      {archivingTasks ? 'Archiving...' : (label || 'Archive Old Tasks')}
    </button>
  );
};

export default ArchiveTasksButton;
