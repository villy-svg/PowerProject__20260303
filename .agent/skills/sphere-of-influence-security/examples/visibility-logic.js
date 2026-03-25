// Example: Using hierarchyService to filter tasks in a component

import { hierarchyService } from '../services/rules/hierarchyService';

const TaskList = ({ user, tasks, permissions, activeVertical }) => {
  // 1. Apply seniority-based filtering
  const visibleTasks = hierarchyService.filterTasksByHierarchy(
    user, 
    tasks, 
    activeVertical, 
    {}, 
    permissions
  );

  return (
    <div>
      {visibleTasks.map(task => (
        <div key={task.id} className={task.isContextOnly ? 'context-only' : ''}>
          {task.text}
          {task.isContextOnly && <span>(Read-Only Path)</span>}
        </div>
      ))}
    </div>
  );
};
