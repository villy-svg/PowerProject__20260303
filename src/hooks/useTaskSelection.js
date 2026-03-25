import { useState, useMemo, useCallback } from 'react';

/**
 * useTaskSelection Hook
 * Manages task selection state and derived consistency properties (e.g. sameStage).
 */
export const useTaskSelection = (tasks = []) => {
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  const clearSelection = useCallback(() => setSelectedTaskIds([]), []);

  const toggleTaskSelection = useCallback((taskId) => {
    setSelectedTaskIds(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
  }, []);

  const selectedTasks = useMemo(() =>
    (tasks || []).filter(t => selectedTaskIds.includes(t.id)),
    [tasks, selectedTaskIds]
  );

  const sameStage = useMemo(() => 
    selectedTasks.length > 0 && selectedTasks.every(t => t.stageId === selectedTasks[0].stageId),
    [selectedTasks]
  );

  const commonStageId = useMemo(() => 
    sameStage ? selectedTasks[0].stageId : null,
    [sameStage, selectedTasks]
  );

  const toggleStageSelection = useCallback((stageId, stageTasks) => {
    const stageTaskIds = stageTasks.map(t => t.id);
    const allInStageSelected = stageTaskIds.every(id => selectedTaskIds.includes(id));
    if (allInStageSelected) {
      setSelectedTaskIds(prev => prev.filter(id => !stageTaskIds.includes(id)));
    } else {
      setSelectedTaskIds(prev => [...new Set([...prev, ...stageTaskIds])]);
    }
  }, [selectedTaskIds]);

  return {
    selectedTaskIds,
    setSelectedTaskIds,
    clearSelection,
    toggleTaskSelection,
    selectedTasks,
    sameStage,
    commonStageId,
    toggleStageSelection
  };
};
