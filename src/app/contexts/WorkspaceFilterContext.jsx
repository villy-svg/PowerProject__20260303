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

  // Filter auto-population has been removed. Filters now default to empty arrays,
  // which logically represents 'Show All' without tightly coupling to task data.

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
      setFilters({
        city: [],
        hub: [],
        priority: [],
        role: [],
        function: [],
        assignee: [],
        duplicatesOnly: false,
        highRemarksOnly: false,
      });
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
