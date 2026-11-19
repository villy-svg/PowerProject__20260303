/**
 * Public entry point for the colocated `task-history` feature module.
 * Canonical location: src/features/task-history/index.js
 */
export {
  IGNORED_HISTORY_FIELDS,
  createEmptyLookupMaps,
} from './utils/fieldFormatters';
export { formatHistoryEvent } from './utils/eventFormatter';
export {
  collapseLinkBursts,
  mergeUnifiedTimeline,
  groupTimelineByDate,
} from './utils/timelineMerger';
export {
  getTaskHistory,
  extractReferencedIds,
  resolveEntityNames,
  clearTaskHistoryCache,
} from './services/taskHistoryService';
