import { useMemo } from 'react';
import { matchesCriteria, createComparisonKey } from '../utils/matchingAlgorithms';

/**
 * useDuplicateDetection Hook (Master)
 * 
 * Takes a list and a configuration, returns items with duplicate metadata.
 * 
 * @param {Array} items - The list of objects to check
 * @param {Object} config - { fields, useFuzzy, threshold, exactFields, activeVertical }
 */
export const useDuplicateDetection = (items = [], config = {}) => {
  const processedItems = useMemo(() => {
    if (!items || items.length === 0) return [];

    const { 
      fields = [], 
      useFuzzy = false, 
      activeVertical = null,
      sortByDuplicates = false 
    } = config;

    // 1. Cluster Detection
    const clusters = {};
    const processed = items.map(item => {
      // Logic for Slave identification
      const targetList = (activeVertical && activeVertical !== 'daily_hub_tasks')
        ? items.filter(i => i.verticalId === activeVertical) 
        : items;

      const duplicates = targetList.filter(other => 
        matchesCriteria(item, other, config)
      );

      const isDuplicate = duplicates.length > 0;
      const duplicateGroup = duplicates.map(d => d.id);
      
      // Generate a cluster key for grouping in UI
      const clusterKey = useFuzzy 
        ? (isDuplicate ? [item.id, ...duplicateGroup].sort().join('-') : item.id)
        : createComparisonKey(item, fields);

      return {
        ...item,
        isDuplicate,
        duplicateCount: isDuplicate ? duplicates.length + 1 : 1,
        duplicateGroup,
        clusterKey
      };
    });

    // 2. Sorting (Optional: group duplicates together)
    if (sortByDuplicates) {
      return processed.sort((a, b) => {
        if (a.isDuplicate && !b.isDuplicate) return -1;
        if (!a.isDuplicate && b.isDuplicate) return 1;
        if (a.isDuplicate && b.isDuplicate) {
          return a.clusterKey.localeCompare(b.clusterKey);
        }
        return 0;
      });
    }

    return processed;
  }, [items, config]);

  return processedItems;
};
