import React from 'react';
import { taskUtils } from '../utils/taskUtils';
import './AssigneeBadge.css';

/**
 * AssigneeBadge
 * Standardized display component for task assignees.
 * Automatically handles the "YOU" display logic when currentUser is provided.
 */
const AssigneeBadge = ({ task, currentUser, className = '' }) => {
  if (!task) return null;

  const label = taskUtils.getAssigneeLabel(task, currentUser);
  const tooltip = taskUtils.getAssigneeTooltip(task);
  
  // Determine if it's the current user or unassigned
  const isCurrentUser = currentUser?.id && task.assigned_to === currentUser.id;
  const isUnassigned = !task.assigned_to || label === 'NULL';

  let modifierClass = '';
  if (isCurrentUser) modifierClass = 'assignee-you';
  else if (isUnassigned) modifierClass = 'assignee-none';
  // Use default class (e.g. assignee-badge) for regular users

  return (
    <span 
      className={`assignee-badge-base ${modifierClass} ${className}`} 
      title={tooltip}
    >
      {label}
    </span>
  );
};

export default AssigneeBadge;
