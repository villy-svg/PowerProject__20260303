import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTaskBoard } from './TaskBoardContext';
import { useAuth } from './AuthContext';
import { taskUtils } from '../../utils/taskUtils';

const WorkspaceFilterContext = createContext();

export const useWorkspaceFilter = () => {
  const context = useContext(WorkspaceFilterContext);
  if (!context) {
    throw new Error('useWorkspaceFilter must be used within a WorkspaceFilterProvider');
  }
  return context;
};

export const WorkspaceFilterProvider = ({ children }) => {
  const { tasks } = useTaskBoard();
  const { user } = useAuth();

  const [filters, setFilters] = useState({
    city: [],
    hub: [],
    priority: [],
    role: [],
    function: [],
    assignee: [],
    duplicatesOnly: false,
    highRemarksOnly: false,
  });
  const [isInitialized, setIsInitialized] = useState(false);

  // Auto-populate filters on first load (Select All by default)
  useEffect(() => {
    if (!Array.isArray(tasks) || tasks.length === 0) return;

    const newCities = [...new Set(tasks.map(t => t.city).filter(Boolean))];
    const newHubs = [...new Set(tasks.map(t => t.hub_id).filter(Boolean))];
    const newPriorities = [...new Set(tasks.map(t => t.priority).filter(Boolean))];
    const newFunctions = [...new Set(tasks.map(t => t.function).filter(Boolean))];
    const newAssignees = [...new Set(tasks.map(t =>
      taskUtils.formatAssigneeForList(t.assigned_to, t.assigneeName, user)
    ).filter(Boolean))];

    if (!isInitialized) {
      setFilters(prev => ({
        ...prev,
        city: newCities,
        hub: newHubs,
        priority: newPriorities,
        function: newFunctions,
        assignee: newAssignees,
      }));
      setIsInitialized(true);
    } else {
      setFilters(prev => ({
        ...prev,
        city: [...new Set([...(prev.city || []), ...newCities])],
        hub: [...new Set([...(prev.hub || []), ...newHubs])],
        priority: [...new Set([...(prev.priority || []), ...newPriorities])],
        function: [...new Set([...(prev.function || []), ...newFunctions])],
        assignee: [...new Set([...(prev.assignee || []), ...newAssignees])],
      }));
    }
  }, [tasks, user, isInitialized]);

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => {
      const current = prev[key];

      if (typeof current === 'boolean') {
        return { ...prev, [key]: !current };
      }

      const updated = (current || []).includes(value)
        ? current.filter(v => v !== value)
        : [...(current || []), value];
      return { ...prev, [key]: updated };
    });
  }, []);

  const handleBatchFilter = useCallback((key, values) => {
    setFilters(prev => ({ ...prev, [key]: values }));
  }, []);

  const resetFilters = useCallback((newFilters) => {
    if (newFilters) {
      setFilters(newFilters);
    } else {
      setIsInitialized(false);
    }
  }, []);

  const value = {
    filters,
    setFilters,
    handleFilterChange,
    handleBatchFilter,
    resetFilters,
  };

  return (
    <WorkspaceFilterContext.Provider value={value}>
      {children}
    </WorkspaceFilterContext.Provider>
  );
};
