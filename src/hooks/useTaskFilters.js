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
  drillDownId
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

  // 3. Metadata & Context Filtering
  const filteredTasks = useMemo(() => {
    return hierarchyFilteredTasks.filter(t => {
      // 0. Strict Vertical Filter
      const targetVerticalId = rootVerticalId || activeVertical;
      if (t.verticalId !== targetVerticalId && activeVertical !== 'daily_hub_tasks') return false;
      if (activeVertical === 'daily_hub_tasks' && t.verticalId !== 'daily_hub_tasks') return false;

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
      return true;
    });
  }, [hierarchyFilteredTasks, viewMode, drillDownId, permissions.canViewKanbanHierarchy, filters, rootVerticalId, activeVertical, user]);

  return {
    tasksWithDuplicateInfo,
    hierarchyFilteredTasks,
    filteredTasks
  };
};
