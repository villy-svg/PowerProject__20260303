/**
 * timelineMerger.js
 * Pure timeline assembly pipeline:
 *   1. `collapseLinkBursts` — collapses noisy `task_context_links` delete-and-reinsert syncs
 *      and suppresses duplicate `assignee`/`hub` links already captured by INSERT/UPDATE.
 *   2. `mergeUnifiedTimeline` — merges submissions + formatted history + legacy synthetic
 *      creation anchor, sorted newest-first with deterministic causal tie-breaking.
 *   3. `groupTimelineByDate` — buckets sorted items into calendar-day sections.
 *
 * No React dependencies. No Supabase calls.
 * Canonical location: src/features/task-history/utils/timelineMerger.js
 */
import {
  isPlainObject,
  toSafeEpochMs,
  resolveActorName,
  getLinkEntityType,
  getLinkEntityId,
} from './fieldFormatters';
import { formatHistoryEvent } from './eventFormatter';

/** Default burst-collapse and duplicate-suppression window in milliseconds. */
const DEFAULT_BURST_WINDOW_MS = 2500;

// ---------------------------------------------------------------------------
// 1. Burst-Collapse & Redundant Link Suppression
// ---------------------------------------------------------------------------

/**
 * Collapses noisy `task_context_links` DELETE-then-INSERT bursts (which occur on every
 * `syncContextLinks` call) and suppresses redundant `assignee`/`hub` link events that
 * duplicate an adjacent `tasks` INSERT or UPDATE on `assigned_to`/`hub_id`.
 *
 * @param {Array<Object>} historyRows - Raw rows from `public.tasks_history`
 * @param {number} [windowMs=2500] - Grouping window in milliseconds
 * @returns {Array<Object>}
 */
export const collapseLinkBursts = (historyRows = [], windowMs = DEFAULT_BURST_WINDOW_MS) => {
  if (!Array.isArray(historyRows) || historyRows.length === 0) return [];

  // Sort ascending so bursts are scanned deterministically in chronological order
  const sorted = [...historyRows].sort((a, b) => {
    const diff = toSafeEpochMs(a?.changed_at) - toSafeEpochMs(b?.changed_at);
    return diff !== 0 ? diff : String(a?.id || '').localeCompare(String(b?.id || ''));
  });

  const nonLinkRows = [];
  const linkRows = [];
  for (const row of sorted) {
    if (!row || typeof row !== 'object') continue;
    if (row.action === 'LINK_ADD' || row.action === 'LINK_REMOVE') linkRows.push(row);
    else nonLinkRows.push(row);
  }

  // Group link rows by (actor_id, entity_type) within sliding `windowMs`
  // Handles interleaved Promise.all link syncs cleanly.
  const completedGroups = [];
  const activeGroups = new Map();

  for (const row of linkRows) {
    const actorKey = row.actor_id ? String(row.actor_id) : '__system__';
    const entityType = getLinkEntityType(row);
    const groupKey = `${actorKey}::${entityType}`;
    const ts = toSafeEpochMs(row.changed_at);

    const existing = activeGroups.get(groupKey);
    if (existing && ts - existing.lastTs <= windowMs) {
      existing.rows.push(row);
      existing.lastTs = ts;
    } else {
      if (existing) completedGroups.push(existing);
      activeGroups.set(groupKey, { actorKey, entityType, lastTs: ts, rows: [row] });
    }
  }
  completedGroups.push(...activeGroups.values());

  // Build index of scalar INSERT/UPDATE rows to suppress duplicate assignee/hub links
  const scalarAnchors = nonLinkRows
    .filter((r) => r.action === 'INSERT' || r.action === 'UPDATE')
    .map((r) => {
      const oldP = isPlainObject(r.old_payload) ? r.old_payload : {};
      const newP = isPlainObject(r.new_payload) ? r.new_payload : {};
      return {
        action: r.action,
        actorKey: r.actor_id ? String(r.actor_id) : '__system__',
        ts: toSafeEpochMs(r.changed_at),
        oldAssignee: oldP.assigned_to || oldP.assignedto || null,
        newAssignee: newP.assigned_to || newP.assignedto || null,
        oldHub: oldP.hub_id || oldP.hubid || null,
        newHub: newP.hub_id || newP.hubid || null,
      };
    });

  const collapsedLinkRows = [];

  for (const group of completedGroups) {
    const netByEntityId = new Map();
    for (const row of group.rows) {
      const entityId = getLinkEntityId(row);
      if (!entityId) continue;
      netByEntityId.set(entityId, (netByEntityId.get(entityId) || 0) + (row.action === 'LINK_ADD' ? 1 : -1));
    }

    let addedIds = [];
    let removedIds = [];
    for (const [entityId, net] of netByEntityId.entries()) {
      if (net > 0) addedIds.push(entityId);
      else if (net < 0) removedIds.push(entityId);
    }

    if (addedIds.length === 0 && removedIds.length === 0) continue;

    // Suppress redundant `assignee` / `hub` links already captured by INSERT/UPDATE
    if (group.entityType === 'assignee' || group.entityType === 'hub') {
      const matchingAnchors = scalarAnchors.filter(
        (a) => a.actorKey === group.actorKey && Math.abs(a.ts - group.lastTs) <= windowMs
      );
      for (const anchor of matchingAnchors) {
        const newScalar = group.entityType === 'assignee' ? anchor.newAssignee : anchor.newHub;
        const oldScalar = group.entityType === 'assignee' ? anchor.oldAssignee : anchor.oldHub;
        if (newScalar) addedIds = addedIds.filter((id) => id !== String(newScalar));
        if (anchor.action === 'UPDATE' && oldScalar) {
          removedIds = removedIds.filter((id) => id !== String(oldScalar));
        }
      }
    }

    if (addedIds.length === 0 && removedIds.length === 0) continue;

    const rep = group.rows[group.rows.length - 1];
    collapsedLinkRows.push({
      ...rep,
      action:
        addedIds.length > 0 && removedIds.length === 0
          ? 'LINK_ADD'
          : removedIds.length > 0 && addedIds.length === 0
            ? 'LINK_REMOVE'
            : 'LINK_UPDATE',
      _collapsedLink: { entityType: group.entityType, addedIds, removedIds },
    });
  }

  return [...nonLinkRows, ...collapsedLinkRows];
};

// ---------------------------------------------------------------------------
// 2. Unified Timeline Merger & Causal Tie-Breaker
// ---------------------------------------------------------------------------

const normalizeSubmissionItem = (submission, lookupMaps, currentUser) => {
  if (!submission || typeof submission !== 'object') return null;
  const timestamp = submission.created_at || null;
  const actorId = submission.submitted_by || null;
  const profile = submission.submitted_by_profile || null;

  return {
    id: `sub_${submission.id}`,
    kind: 'submission',
    timestamp,
    sortKey: toSafeEpochMs(timestamp),
    actorId,
    actorName: resolveActorName({
      actorId,
      actorName: profile?.name,
      actorEmail: profile?.email,
      lookupMaps,
      currentUser,
    }),
    data: submission,
  };
};

/** Synthesizes a "Created task" anchor for legacy tasks created before `tasks_history`. */
const buildSyntheticCreatedEvent = (task, lookupMaps, currentUser) => {
  if (!task || typeof task !== 'object') return null;
  const createdAt = task.created_at || task.createdAt || null;
  if (!createdAt) return null;

  const actorId = task.created_by || task.createdBy || null;
  return {
    id: `synth_created_${task.id || 'task'}`,
    kind: 'history',
    timestamp: createdAt,
    sortKey: toSafeEpochMs(createdAt),
    actorId,
    actorName: resolveActorName({ actorId, lookupMaps, currentUser }),
    data: {
      action: 'INSERT',
      eventType: 'created',
      summary: 'Created task',
      changes: [],
      isSynthetic: true,
    },
  };
};

/**
 * Higher weight appears HIGHER (closer to top) when two events share the same millisecond.
 * Causal order top-down: stage move (e.g., REVIEW) > submission > edit/link > created.
 */
const getTieBreakWeight = (item) => {
  if (item.kind === 'history') {
    if (item.data?.eventType === 'stage') return 40;
    if (item.data?.eventType === 'delete') return 35;
    if (item.data?.eventType === 'created') return 10;
    return 20;
  }
  return item.kind === 'submission' ? 30 : 15;
};

/**
 * Merges `submissions` and `historyRows` into a single newest-first `UnifiedTimelineItem[]`.
 *
 * @param {Object} params
 * @param {Array<Object>} [params.submissions=[]]
 * @param {Array<Object>} [params.historyRows=[]]
 * @param {Object} [params.lookupMaps={}]
 * @param {Object|null} [params.task=null]
 * @param {Object} [params.currentUser={}]
 * @param {Array<Object>} [params.extraItems=[]] - Extensibility hook (e.g., future comments)
 * @returns {Array<Object>}
 */
export const mergeUnifiedTimeline = ({
  submissions = [],
  historyRows = [],
  lookupMaps = {},
  task = null,
  currentUser = {},
  extraItems = [],
} = {}) => {
  const collapsedHistory = collapseLinkBursts(Array.isArray(historyRows) ? historyRows : []);
  const formattedHistory = collapsedHistory
    .map((row) => formatHistoryEvent(row, lookupMaps, currentUser))
    .filter(Boolean);

  if (!formattedHistory.some((item) => item.data?.action === 'INSERT')) {
    const synthetic = buildSyntheticCreatedEvent(task, lookupMaps, currentUser);
    if (synthetic) formattedHistory.push(synthetic);
  }

  const normalizedSubmissions = (Array.isArray(submissions) ? submissions : [])
    .map((sub) => normalizeSubmissionItem(sub, lookupMaps, currentUser))
    .filter(Boolean);

  const combined = [
    ...normalizedSubmissions,
    ...formattedHistory,
    ...(Array.isArray(extraItems) ? extraItems : []),
  ];

  return combined.sort((a, b) => {
    const timeDiff = (b.sortKey || 0) - (a.sortKey || 0);
    if (timeDiff !== 0) return timeDiff;

    const weightDiff = getTieBreakWeight(b) - getTieBreakWeight(a);
    if (weightDiff !== 0) return weightDiff;

    return String(b.id || '').localeCompare(String(a.id || ''));
  });
};

// ---------------------------------------------------------------------------
// 3. Date-Group Bucketing Helper
// ---------------------------------------------------------------------------

const toLocalDayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const formatDateDividerLabel = (date, nowDate) => {
  const dayKey = toLocalDayKey(date);
  if (dayKey === toLocalDayKey(nowDate)) return 'Today';

  const yesterday = new Date(nowDate);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey === toLocalDayKey(yesterday)) return 'Yesterday';

  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Groups an already-sorted `UnifiedTimelineItem[]` into calendar-day buckets
 * (`"Today"`, `"Yesterday"`, `"18 Nov 2026"`). Preserves input order.
 *
 * @param {Array<Object>} items
 * @param {Date} [now=new Date()]
 * @returns {Array<{ dateKey: string, label: string, items: Array<Object> }>}
 */
export const groupTimelineByDate = (items = [], now = new Date()) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const groups = [];
  const groupByKey = new Map();

  for (const item of items) {
    const ms = item?.sortKey || toSafeEpochMs(item?.timestamp);
    let dateKey = 'unknown';
    let label = 'Earlier';

    if (ms > 0) {
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) {
        dateKey = toLocalDayKey(d);
        label = formatDateDividerLabel(d, now);
      }
    }

    let bucket = groupByKey.get(dateKey);
    if (!bucket) {
      bucket = { dateKey, label, items: [] };
      groupByKey.set(dateKey, bucket);
      groups.push(bucket);
    }
    bucket.items.push(item);
  }

  return groups;
};
