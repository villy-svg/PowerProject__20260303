import { useMemo } from 'react';
import { useDuplicateDetection } from './useDuplicateDetection';
import { hierarchyService } from '../services/rules/hierarchyService';
import { taskUtils } from '../utils/taskUtils';

/**
 * useTaskFilters Hook
 * Handles multi-layered filtering: Duplicate Detection -> Hierarchy -> Metadata.
 */
export const useTaskFilters = ({
  tasks,
  user,
  activeVertical,
  rootVerticalId,
  verticals,
  permissions,
  filters,
  viewMode,
  drillDownId,
  showReworkOnly,
  showMyTasksOnly
}) => {
  // 1. Duplicate Detection
  const tasksWithDuplicateInfo = useDuplicateDetection(tasks, {
    fields: ['text', 'priority', 'hub_id', 'function'],
    activeVertical: rootVerticalId || activeVertical,
    sortByDuplicates: true
  });

  // 2. Hierarchy Filtering
  const hierarchyFilteredTasks = useMemo(() => 
    hierarchyService.filterTasksByHierarchy(user, tasksWithDuplicateInfo, activeVertical, verticals, permissions),
    [user, tasksWithDuplicateInfo, activeVertical, verticals, permissions]
  );

  // 3. Metadata & Context Filtering (includes Review Descendant calculation)
  const filteredTasks = useMemo(() => {
    // 3.1 Pre-calculate Recursive Review Status
    // We do this here once per task set for performance
    const taskMap = new Map(hierarchyFilteredTasks.map(t => [t.id, t]));
    const parentToChildren = new Map();
    hierarchyFilteredTasks.forEach(t => {
      if (t.parentTask) {
        if (!parentToChildren.has(t.parentTask)) parentToChildren.set(t.parentTask, []);
        parentToChildren.get(t.parentTask).push(t.id);
      }
    });

    const checkCache = new Map();
    const hasReviewDescendant = (taskId) => {
      if (checkCache.has(taskId)) return checkCache.get(taskId);
      
      const children = parentToChildren.get(taskId) || [];
      for (const childId of children) {
        const child = taskMap.get(childId);
        if (!child) continue;
        
        // If child is in REVIEW, or child has a review descendant, then parent does too
        if (child.stageId === 'REVIEW' || hasReviewDescendant(childId)) {
          checkCache.set(taskId, true);
          return true;
        }
      }
      
      checkCache.set(taskId, false);
      return false;
    };

    const tasksWithReviewInfo = hierarchyFilteredTasks.map(t => ({
      ...t,
      hasReviewDescendant: hasReviewDescendant(t.id)
    }));

    return tasksWithReviewInfo.filter(t => {
      // 0. Strict Vertical Filter
      const targetVerticalId = rootVerticalId || activeVertical;
      const verticalMatch = t.verticalId === targetVerticalId;
      
      if (!verticalMatch) {
        // Log if it belongs to the Daily Board to debug why it's missing
        if (Array.isArray(t.task_board) && t.task_board.includes('Hubs Daily')) {
          console.warn(`[TaskFilter] Hiding Daily Task "${t.text}" due to vertical mismatch. Task Vertical: ${t.verticalId}, Expected: ${targetVerticalId}`);
        }
        return false;
      }

      // 0.1 Kanban-Specific Visibility
      if (viewMode === 'kanban') {
        if (permissions.canViewKanbanHierarchy) {
          if (drillDownId === null) {
            if (t.parentTask !== null && t.parentTask !== undefined && t.parentTask !== "") return false;
          } else {
            if (t.parentTask !== drillDownId) return false;
          }
        }
      }

      // 1. Duplicates Only
      if (filters?.duplicatesOnly && !t.isDuplicate) return false;

      // 2. Metadata filters
      if (filters?.city?.length > 0 && !filters.city.includes(t.city)) return false;
      if (filters?.hub?.length > 0 && !filters.hub.includes(t.hub_id)) return false;
      if (filters?.priority?.length > 0 && !filters.priority.includes(t.priority)) return false;
      if (filters?.function?.length > 0 && !filters.function.includes(t.function)) return false;
      if (filters?.assignee?.length > 0) {
        const formattedAssignee = taskUtils.formatAssigneeForList(t.assigned_to, t.assigneeName, user);
        if (!filters.assignee.includes(formattedAssignee)) return false;
      }

      // 3. Rework Filter
      if (showReworkOnly && t.latestSubmission?.status !== 'rejected') return false;

      // 4. My Tasks Filter
      if (showMyTasksOnly) {
        const assignedTo = t.assigned_to || [];
        const isMe = (user?.employeeId && assignedTo.includes(user.employeeId)) ||
                     (user?.id && assignedTo.includes(user.id));
        if (!isMe) return false;
      }

      return true;
    });
  }, [hierarchyFilteredTasks, viewMode, drillDownId, permissions.canViewKanbanHierarchy, filters, rootVerticalId, activeVertical, user, showReworkOnly, showMyTasksOnly]);

  return {
    tasksWithDuplicateInfo,
    hierarchyFilteredTasks,
    filteredTasks
  };
};
