/**
 * taskHistoryResolver.js
 * Batched UUID extractor and TTL-cached entity name resolver for `public.tasks_history`.
 *
 * - Strictly validates UUIDs before querying (prevents Postgres `22P02`).
 * - Skips empty buckets (0 extra queries when only stage/priority changed).
 * - Chunks `.in('id', ...)` queries in batches of 50.
 * - Uses `Promise.allSettled` so one table's RLS/schema failure never breaks other lookups.
 * - Cross-resolves unresolved `employeeIds` against `user_profiles` for legacy rows.
 *
 * Canonical location: src/features/task-history/services/taskHistoryResolver.js
 */
import { supabase } from '../../../services/core/supabaseClient';
import {
  createEmptyLookupMaps,
  isPlainObject,
  isUUID,
} from '../utils/fieldFormatters';

/** Maximum IDs per `.in('id', ...)` query to stay safely under PostgREST URL limits. */
const IN_CHUNK_SIZE = 50;

/** In-memory name cache TTL (5 minutes). Keeps display names fresh across renames & impersonation. */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Table metadata for batched entity resolution.
 * Column names verified against `supabase/migrations/20260101000001_tables.sql`.
 */
const ENTITY_TABLE_CONFIG = {
  users: { table: 'user_profiles', select: 'id, name, email', toLabel: (r) => r?.name || r?.email || null },
  employees: { table: 'employees', select: 'id, full_name, emp_code', toLabel: (r) => r?.full_name || r?.emp_code || null },
  hubs: { table: 'hubs', select: 'id, name, hub_code', toLabel: (r) => r?.name || r?.hub_code || null },
  clients: { table: 'clients', select: 'id, name', toLabel: (r) => r?.name || null },
  partners: { table: 'partners', select: 'id, name', toLabel: (r) => r?.name || null },
  vendors: { table: 'vendors', select: 'id, name', toLabel: (r) => r?.name || null },
  tasks: { table: 'tasks', select: 'id, text', toLabel: (r) => r?.text || null },
};

/**
 * Module-level cache: bucketName -> Map<uuid, { value: string, expiresAt: number }>.
 * Only positive resolutions are cached so newly accessible/created rows resolve immediately.
 */
const entityNameCache = new Map(
  Object.keys(ENTITY_TABLE_CONFIG).map((bucket) => [bucket, new Map()])
);

/**
 * Clears all cached entity display names.
 * Call on auth logout, impersonation switch, or inside unit tests.
 */
export const clearTaskHistoryCache = () => {
  for (const map of entityNameCache.values()) {
    map.clear();
  }
};

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

const addUuidToSet = (set, value) => {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((v) => addUuidToSet(set, v));
    return;
  }
  if (isUUID(value)) set.add(value.trim());
};

const chunkArray = (arr, size = IN_CHUNK_SIZE) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
};

const getCachedName = (bucket, id, now) => {
  const bucketCache = entityNameCache.get(bucket);
  const entry = bucketCache?.get(id);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    bucketCache.delete(id);
    return null;
  }
  return entry.value;
};

const setCachedName = (bucket, id, value, now) => {
  const bucketCache = entityNameCache.get(bucket);
  if (!bucketCache || !value) return;
  bucketCache.set(id, { value, expiresAt: now + CACHE_TTL_MS });
};

// ---------------------------------------------------------------------------
// Batched UUID Collector
// ---------------------------------------------------------------------------

/**
 * Scans `tasks_history` rows (and optional parent task metadata) once to collect
 * unique, validated UUIDs grouped by lookup table.
 *
 * @param {Array<Object>} rows
 * @param {Object|null} [task=null]
 */
export const extractReferencedIds = (rows = [], task = null) => {
  const userIds = new Set();
  const employeeIds = new Set();
  const hubIds = new Set();
  const clientIds = new Set();
  const partnerIds = new Set();
  const vendorIds = new Set();
  const taskIds = new Set();

  if (task && typeof task === 'object') {
    addUuidToSet(userIds, task.createdBy || task.created_by);
  }

  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;

      if (row.actor_id && !row.actor_name && !row.actor_email) {
        addUuidToSet(userIds, row.actor_id);
      }

      const oldP = isPlainObject(row.old_payload) ? row.old_payload : {};
      const newP = isPlainObject(row.new_payload) ? row.new_payload : {};

      addUuidToSet(userIds, oldP.created_by);
      addUuidToSet(userIds, newP.created_by);

      addUuidToSet(employeeIds, oldP.assigned_to);
      addUuidToSet(employeeIds, newP.assigned_to);
      addUuidToSet(employeeIds, oldP.assignedto);
      addUuidToSet(employeeIds, newP.assignedto);

      addUuidToSet(hubIds, oldP.hub_id);
      addUuidToSet(hubIds, newP.hub_id);
      addUuidToSet(hubIds, oldP.hubid);
      addUuidToSet(hubIds, newP.hubid);

      addUuidToSet(taskIds, oldP.parent_task_id);
      addUuidToSet(taskIds, newP.parent_task_id);
      addUuidToSet(taskIds, oldP.parent_task);
      addUuidToSet(taskIds, newP.parent_task);

      if (row.action === 'LINK_ADD' || row.action === 'LINK_REMOVE') {
        const linkPayload = row.action === 'LINK_REMOVE' ? oldP : newP;
        const entityId = row.entity_id || linkPayload.entity_id;
        switch (linkPayload.entity_type) {
          case 'assignee':
          case 'employee':
            addUuidToSet(employeeIds, entityId);
            break;
          case 'hub':
            addUuidToSet(hubIds, entityId);
            break;
          case 'client':
            addUuidToSet(clientIds, entityId);
            break;
          case 'partner':
            addUuidToSet(partnerIds, entityId);
            break;
          case 'vendor':
            addUuidToSet(vendorIds, entityId);
            break;
          default:
            break;
        }
      }
    }
  }

  return {
    userIds: Array.from(userIds),
    employeeIds: Array.from(employeeIds),
    hubIds: Array.from(hubIds),
    clientIds: Array.from(clientIds),
    partnerIds: Array.from(partnerIds),
    vendorIds: Array.from(vendorIds),
    taskIds: Array.from(taskIds),
  };
};

// ---------------------------------------------------------------------------
// Batched Name Resolution
// ---------------------------------------------------------------------------

const resolveBucket = async (bucketKey, rawIds, dbClient, now) => {
  const config = ENTITY_TABLE_CONFIG[bucketKey];
  const resolvedMap = {};
  if (!config || !Array.isArray(rawIds) || rawIds.length === 0) {
    return { resolvedMap, missingIds: [] };
  }

  const uncachedIds = [];
  for (const id of rawIds) {
    if (!isUUID(id)) continue;
    const cached = getCachedName(bucketKey, id, now);
    if (cached) resolvedMap[id] = cached;
    else uncachedIds.push(id);
  }

  if (uncachedIds.length === 0) return { resolvedMap, missingIds: [] };

  const chunks = chunkArray(uncachedIds, IN_CHUNK_SIZE);
  const chunkResults = await Promise.allSettled(
    chunks.map((chunk) => dbClient.from(config.table).select(config.select).in('id', chunk))
  );

  for (const result of chunkResults) {
    if (result.status !== 'fulfilled') continue;
    const { data, error } = result.value || {};
    if (error || !Array.isArray(data)) continue;

    for (const row of data) {
      const label = config.toLabel(row);
      if (row?.id && label) {
        resolvedMap[row.id] = label;
        setCachedName(bucketKey, row.id, label, now);
      }
    }
  }

  return { resolvedMap, missingIds: uncachedIds.filter((id) => !resolvedMap[id]) };
};

/**
 * Batch-resolves UUID buckets into human-readable display name maps.
 *
 * @param {Object} idBuckets - Output of `extractReferencedIds`
 * @param {Object} [options={}]
 * @param {Object} [options.client=supabase] - Injectable Supabase client for testing
 * @returns {Promise<Object>}
 */
export const resolveEntityNames = async (idBuckets = {}, options = {}) => {
  const dbClient = options.client || supabase;
  const now = Date.now();
  const lookupMaps = createEmptyLookupMaps();

  const activePairs = [
    ['users', idBuckets.userIds],
    ['employees', idBuckets.employeeIds],
    ['hubs', idBuckets.hubIds],
    ['clients', idBuckets.clientIds],
    ['partners', idBuckets.partnerIds],
    ['vendors', idBuckets.vendorIds],
    ['tasks', idBuckets.taskIds],
  ].filter(([, ids]) => Array.isArray(ids) && ids.length > 0);

  if (activePairs.length === 0) return lookupMaps;

  const settled = await Promise.allSettled(
    activePairs.map(async ([bucketKey, ids]) => ({
      bucketKey,
      ...(await resolveBucket(bucketKey, ids, dbClient, now)),
    }))
  );

  let unresolvedEmployeeIds = [];
  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue;
    const { bucketKey, resolvedMap, missingIds } = outcome.value;
    lookupMaps[bucketKey] = { ...lookupMaps[bucketKey], ...resolvedMap };
    if (bucketKey === 'employees' && missingIds.length > 0) {
      unresolvedEmployeeIds = missingIds;
    }
  }

  // Fallback cross-resolution: if an `assigned_to` / `assignee` UUID wasn't found in
  // `public.employees`, check `public.user_profiles` (covers legacy rows storing user IDs).
  if (unresolvedEmployeeIds.length > 0) {
    try {
      const { resolvedMap } = await resolveBucket('users', unresolvedEmployeeIds, dbClient, now);
      Object.assign(lookupMaps.employees, resolvedMap);
    } catch {
      // Non-fatal; formatter falls back to "Former Member"
    }
  }

  return lookupMaps;
};
