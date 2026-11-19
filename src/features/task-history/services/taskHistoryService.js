/**
 * taskHistoryService.js
 * Resilient, read-only RPC service for fetching `public.tasks_history` rows via
 * `get_task_activity_timeline` with graceful pre-migration degradation.
 *
 * Canonical location: src/features/task-history/services/taskHistoryService.js
 */
import { supabase } from '../../../services/core/supabaseClient';
import { createEmptyLookupMaps, isUUID } from '../utils/fieldFormatters';
import {
  extractReferencedIds,
  resolveEntityNames,
  clearTaskHistoryCache,
} from './taskHistoryResolver';

export { extractReferencedIds, resolveEntityNames, clearTaskHistoryCache };

/** Postgres / PostgREST error codes that indicate the RPC is not yet deployed or not permitted. */
const DEGRADED_RPC_CODES = new Set(['42883', 'PGRST202', '42501']);

const isDegradedRpcError = (error) => {
  if (!error) return false;
  if (DEGRADED_RPC_CODES.has(error.code)) return true;
  const msg = String(error.message || '').toLowerCase();
  return (
    msg.includes('get_task_activity_timeline') &&
    (msg.includes('does not exist') || msg.includes('could not find the function'))
  );
};

/**
 * Fetches `public.tasks_history` rows for a task via the scoped `get_task_activity_timeline`
 * RPC and resolves all referenced entity UUIDs in minimal parallel round-trips.
 *
 * Pre-migration safe: if the RPC is not yet deployed (`42883` / `PGRST202`) or permission is
 * denied (`42501`), logs a single `console.warn` and returns `{ rows: [], lookupMaps, degraded: true }`.
 *
 * @param {string} taskId - UUID of the task
 * @param {Object} [options={}]
 * @param {number} [options.limit=100] - Max rows to fetch
 * @param {string|null} [options.beforeTimestamp=null] - Cursor for pagination ("Load older")
 * @param {string} [options.sourceType='task'] - Source type filter (`'task' | 'daily_task' | 'template'`)
 * @param {Object|null} [options.task=null] - Optional task object (to resolve legacy `created_by`)
 * @param {AbortSignal|null} [options.signal=null] - Optional AbortSignal to skip lookup work on rapid switch
 * @param {Object} [options.client=supabase] - Injectable Supabase client override (for tests)
 * @returns {Promise<{ rows: Array<Object>, lookupMaps: Object, degraded: boolean }>}
 */
export const getTaskHistory = async (taskId, options = {}) => {
  const emptyMaps = createEmptyLookupMaps();

  if (!taskId || !isUUID(taskId)) {
    return { rows: [], lookupMaps: emptyMaps, degraded: false };
  }

  // Respect offline dev bypass consistently with taskService.js
  if (import.meta?.env?.DEV && import.meta?.env?.VITE_OFFLINE_BYPASS === 'true') {
    return { rows: [], lookupMaps: emptyMaps, degraded: false };
  }

  const {
    limit = 100,
    beforeTimestamp = null,
    sourceType = 'task',
    task = null,
    signal = null,
    client: dbClient = supabase,
  } = options;

  try {
    const { data, error } = await dbClient.rpc('get_task_activity_timeline', {
      p_task_id: taskId,
      p_limit: limit,
      p_before: beforeTimestamp ?? null,
    });

    if (error) {
      if (isDegradedRpcError(error)) {
        console.warn(
          '[taskHistoryService] get_task_activity_timeline unavailable or restricted; degrading to submissions-only:',
          error.code || error.message
        );
        return { rows: [], lookupMaps: emptyMaps, degraded: true };
      }

      console.error('[taskHistoryService] Failed to fetch task history:', error);
      return { rows: [], lookupMaps: emptyMaps, degraded: true };
    }

    if (signal?.aborted) {
      return { rows: [], lookupMaps: emptyMaps, degraded: false };
    }

    const rawRows = Array.isArray(data) ? data : [];
    const rows = sourceType
      ? rawRows.filter((r) => !r?.source_type || r.source_type === sourceType)
      : rawRows;

    const idBuckets = extractReferencedIds(rows, task);
    const lookupMaps = await resolveEntityNames(idBuckets, { client: dbClient });

    return { rows, lookupMaps, degraded: false };
  } catch (err) {
    console.error('[taskHistoryService] Unexpected error in getTaskHistory:', err);
    return { rows: [], lookupMaps: emptyMaps, degraded: true };
  }
};
