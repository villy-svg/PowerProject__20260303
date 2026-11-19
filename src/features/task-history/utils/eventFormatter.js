/**
 * eventFormatter.js
 * Formats a single (burst-collapsed) `public.tasks_history` row into a normalized
 * `UnifiedTimelineItem` (`kind: 'history'`), or returns `null` for noise-only rows.
 *
 * No React dependencies. No Supabase calls.
 * Canonical location: src/features/task-history/utils/eventFormatter.js
 */
import {
  IGNORED_HISTORY_FIELDS,
  isPlainObject,
  isEmptyValue,
  isSensitiveDescription,
  areFieldValuesEquivalent,
  canonicalizeField,
  getFieldLabel,
  toTitleCaseFromSnake,
  toSafeEpochMs,
  truncateText,
  resolveEntityLabel,
  resolveActorName,
  formatFieldValue,
  getLinkEntityType,
  getLinkEntityId,
  pluralizeEntityType,
} from './fieldFormatters';

/** Snapshot fields displayed in the expandable drawer for `INSERT` events. */
const INSERT_SNAPSHOT_FIELDS = [
  ['stage_id', 'stageid'],
  ['priority'],
  ['assigned_to', 'assignedto'],
  ['hub_id', 'hubid'],
];

const makeHistoryItem = (meta, data) => ({
  id: meta.id,
  kind: 'history',
  timestamp: meta.timestamp,
  sortKey: meta.sortKey,
  actorId: meta.actorId,
  actorName: meta.actorName,
  data,
});

// ---------------------------------------------------------------------------
// Action-Specific Formatters
// ---------------------------------------------------------------------------

const formatInsertEvent = (meta, newPayload, lookupMaps) => {
  const changes = [];
  for (const [canonicalKey, legacyKey] of INSERT_SNAPSHOT_FIELDS) {
    const val = newPayload[canonicalKey] ?? (legacyKey ? newPayload[legacyKey] : undefined);
    if (!isEmptyValue(val)) {
      changes.push({
        field: canonicalKey,
        label: getFieldLabel(canonicalKey),
        oldValue: null,
        newValue: formatFieldValue(canonicalKey, val, lookupMaps),
      });
    }
  }

  return makeHistoryItem(meta, {
    action: 'INSERT',
    eventType: 'created',
    summary: 'Created task',
    changes,
    isSynthetic: false,
  });
};

const formatLinkEvent = (meta, row, lookupMaps) => {
  const { action } = row;
  const collapsed = row._collapsedLink || {
    entityType: getLinkEntityType(row),
    addedIds: action === 'LINK_ADD' && getLinkEntityId(row) ? [getLinkEntityId(row)] : [],
    removedIds: action === 'LINK_REMOVE' && getLinkEntityId(row) ? [getLinkEntityId(row)] : [],
  };

  const { entityType, addedIds, removedIds } = collapsed;
  const addedNames = addedIds.map((id) => resolveEntityLabel(entityType, id, lookupMaps));
  const removedNames = removedIds.map((id) => resolveEntityLabel(entityType, id, lookupMaps));
  const titleType = toTitleCaseFromSnake(entityType);

  if (addedNames.length === 0 && removedNames.length === 0) return null;

  let summary = '';
  const changes = [];

  if (addedNames.length > 0 && removedNames.length === 0) {
    if (addedNames.length === 1) {
      summary = `Linked ${entityType}: ${addedNames[0]}`;
    } else {
      summary = `Linked ${addedNames.length} ${pluralizeEntityType(entityType, addedNames.length)}`;
      addedNames.forEach((name) =>
        changes.push({ field: `link_${entityType}`, label: `Linked ${titleType}`, oldValue: null, newValue: name })
      );
    }
  } else if (removedNames.length > 0 && addedNames.length === 0) {
    if (removedNames.length === 1) {
      summary = `Unlinked ${entityType}: ${removedNames[0]}`;
    } else {
      summary = `Unlinked ${removedNames.length} ${pluralizeEntityType(entityType, removedNames.length)}`;
      removedNames.forEach((name) =>
        changes.push({ field: `unlink_${entityType}`, label: `Unlinked ${titleType}`, oldValue: name, newValue: null })
      );
    }
  } else {
    summary = `Updated linked ${pluralizeEntityType(entityType, 2)}`;
    removedNames.forEach((name) =>
      changes.push({ field: `unlink_${entityType}`, label: `Removed ${titleType}`, oldValue: name, newValue: null })
    );
    addedNames.forEach((name) =>
      changes.push({ field: `link_${entityType}`, label: `Added ${titleType}`, oldValue: null, newValue: name })
    );
  }

  return makeHistoryItem(meta, {
    action,
    eventType: 'link',
    summary,
    changes,
    isSynthetic: false,
  });
};

/**
 * Formats a single-field UPDATE into an inline sentence + optional expandable diff.
 * Self-explanatory inline updates leave `changes: []` so the UI doesn't render dead-click drawers.
 */
const formatSingleFieldUpdate = (meta, { canonicalKey, oldVal, newVal }, lookupMaps) => {
  let summary = '';
  let eventType = 'edit';
  let stageTo;
  const changes = [];

  const fromLabel = formatFieldValue(canonicalKey, oldVal, lookupMaps);
  const toLabel = formatFieldValue(canonicalKey, newVal, lookupMaps);

  switch (canonicalKey) {
    case 'stage_id':
      eventType = 'stage';
      stageTo = newVal;
      summary = `Moved stage from ${fromLabel} → ${toLabel}`;
      break;
    case 'priority':
      summary = `Changed priority from ${fromLabel} → ${toLabel}`;
      break;
    case 'assigned_to': {
      const hadOld = !isEmptyValue(oldVal);
      const hasNew = !isEmptyValue(newVal);
      if (!hadOld && hasNew) summary = `Assigned to ${toLabel}`;
      else if (hadOld && !hasNew) summary = `Unassigned from ${fromLabel}`;
      else summary = `Reassigned from ${fromLabel} → ${toLabel}`;
      break;
    }
    case 'hub_id':
      summary = `Changed hub from ${fromLabel} → ${toLabel}`;
      break;
    case 'text':
      summary = 'Renamed task';
      changes.push({ field: 'text', label: 'Title', oldValue: fromLabel, newValue: toLabel });
      break;
    case 'description':
      if (isSensitiveDescription(oldVal) || isSensitiveDescription(newVal)) {
        summary = 'Updated structured request details';
      } else {
        const preview = truncateText(String(newVal || ''));
        summary = preview ? `Updated description: "${preview}"` : 'Cleared description';
        changes.push({ field: 'description', label: 'Description', oldValue: fromLabel, newValue: toLabel });
      }
      break;
    case 'task_board':
      summary =
        fromLabel !== 'None' && toLabel !== 'None'
          ? `Updated board placement: ${fromLabel} → ${toLabel}`
          : 'Updated board placement';
      break;
    case 'metadata':
      summary = 'Updated task metadata';
      break;
    case 'city':
    case 'function':
    case 'vertical_id':
    case 'parent_task_id':
      summary = `Changed ${getFieldLabel(canonicalKey).toLowerCase()} from ${fromLabel} → ${toLabel}`;
      break;
    default:
      summary = `Updated ${getFieldLabel(canonicalKey)}`;
      changes.push({
        field: canonicalKey,
        label: getFieldLabel(canonicalKey),
        oldValue: formatFieldValue(canonicalKey, oldVal, lookupMaps, { truncate: true }),
        newValue: formatFieldValue(canonicalKey, newVal, lookupMaps, { truncate: true }),
      });
      break;
  }

  return makeHistoryItem(meta, {
    action: 'UPDATE',
    eventType,
    ...(stageTo !== undefined ? { stageTo } : {}),
    summary,
    changes,
    isSynthetic: false,
  });
};

const formatUpdateEvent = (meta, oldPayload, newPayload, lookupMaps) => {
  const rawKeys = new Set([...Object.keys(oldPayload), ...Object.keys(newPayload)]);
  const meaningfulFields = [];
  const seenCanonical = new Set();

  for (const rawKey of rawKeys) {
    if (IGNORED_HISTORY_FIELDS.has(rawKey)) continue;
    const canonicalKey = canonicalizeField(rawKey);
    if (IGNORED_HISTORY_FIELDS.has(canonicalKey) || seenCanonical.has(canonicalKey)) continue;
    seenCanonical.add(canonicalKey);

    const oldVal = oldPayload[rawKey] !== undefined ? oldPayload[rawKey] : oldPayload[canonicalKey];
    const newVal = newPayload[rawKey] !== undefined ? newPayload[rawKey] : newPayload[canonicalKey];
    if (areFieldValuesEquivalent(canonicalKey, oldVal, newVal)) continue;

    meaningfulFields.push({ canonicalKey, oldVal, newVal });
  }

  // Drop pure noise updates (e.g., only `updated_at` / `last_updated_by` changed)
  if (meaningfulFields.length === 0) return null;
  if (meaningfulFields.length === 1) {
    return formatSingleFieldUpdate(meta, meaningfulFields[0], lookupMaps);
  }

  const labels = meaningfulFields.map((f) => getFieldLabel(f.canonicalKey));
  const preview = labels.slice(0, 3).join(', ');
  const overflow = labels.length > 3 ? ` +${labels.length - 3} more` : '';
  const stageEntry = meaningfulFields.find((f) => f.canonicalKey === 'stage_id');

  const changes = meaningfulFields.map(({ canonicalKey, oldVal, newVal }) => {
    const isRedacted =
      canonicalKey === 'description' &&
      (isSensitiveDescription(oldVal) || isSensitiveDescription(newVal));

    if (isRedacted) {
      return {
        field: canonicalKey,
        label: getFieldLabel(canonicalKey),
        oldValue: null,
        newValue: 'Updated structured request details',
        isRedacted: true,
      };
    }
    if (canonicalKey === 'metadata') {
      return {
        field: canonicalKey,
        label: getFieldLabel(canonicalKey),
        oldValue: null,
        newValue: 'Updated task metadata',
        isRedacted: false,
      };
    }
    return {
      field: canonicalKey,
      label: getFieldLabel(canonicalKey),
      oldValue: formatFieldValue(canonicalKey, oldVal, lookupMaps),
      newValue: formatFieldValue(canonicalKey, newVal, lookupMaps),
      isRedacted: false,
    };
  });

  return makeHistoryItem(meta, {
    action: 'UPDATE',
    eventType: stageEntry ? 'stage' : 'edit',
    ...(stageEntry ? { stageTo: stageEntry.newVal } : {}),
    summary: `Updated ${meaningfulFields.length} fields: ${preview}${overflow}`,
    changes,
    isSynthetic: false,
  });
};

// ---------------------------------------------------------------------------
// Public Entry Point
// ---------------------------------------------------------------------------

/**
 * Formats a single `tasks_history` row (after burst collapse) into a normalized
 * `UnifiedTimelineItem` (or returns `null` if the row is pure noise).
 *
 * @param {Object} row - Raw or burst-collapsed `tasks_history` row
 * @param {Object} [lookupMaps={}] - Resolved name maps
 * @param {Object} [currentUser={}] - Current logged-in user `{ id }`
 * @returns {Object|null}
 */
export const formatHistoryEvent = (row, lookupMaps = {}, currentUser = {}) => {
  if (!row || typeof row !== 'object') return null;

  const { action } = row;
  const oldPayload = isPlainObject(row.old_payload) ? row.old_payload : {};
  const newPayload = isPlainObject(row.new_payload) ? row.new_payload : {};
  const timestamp = row.changed_at || null;
  const sortKey = toSafeEpochMs(timestamp);
  const actorId = row.actor_id || null;

  const meta = {
    id: row.id ? `hist_${row.id}` : `hist_${action}_${sortKey}`,
    timestamp,
    sortKey,
    actorId,
    actorName: resolveActorName({
      actorId,
      actorName: row.actor_name,
      actorEmail: row.actor_email,
      payload: action === 'DELETE' ? oldPayload : newPayload,
      lookupMaps,
      currentUser,
    }),
  };

  if (action === 'INSERT') return formatInsertEvent(meta, newPayload, lookupMaps);
  if (action === 'DELETE') {
    return makeHistoryItem(meta, {
      action: 'DELETE',
      eventType: 'delete',
      summary: 'Deleted task',
      changes: [],
      isSynthetic: false,
    });
  }
  if (action === 'LINK_ADD' || action === 'LINK_REMOVE' || action === 'LINK_UPDATE') {
    return formatLinkEvent(meta, row, lookupMaps);
  }
  if (action === 'UPDATE') return formatUpdateEvent(meta, oldPayload, newPayload, lookupMaps);

  return makeHistoryItem(meta, {
    action: String(action || 'UNKNOWN'),
    eventType: 'edit',
    summary: `Updated task (${toTitleCaseFromSnake(String(action || 'event').toLowerCase())})`,
    changes: [],
    isSynthetic: false,
  });
};
