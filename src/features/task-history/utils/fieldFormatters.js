/**
 * fieldFormatters.js
 * Pure constants, redaction guards, equivalence checks, and human-readable
 * value/entity/actor formatters for `public.tasks_history` payloads.
 *
 * No React dependencies. No Supabase calls.
 * Canonical location: src/features/task-history/utils/fieldFormatters.js
 */
import { TASK_STAGES } from '../../../constants/stages';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Columns that represent technical/audit bookkeeping rather than meaningful user edits.
 * If an UPDATE row only touches columns in this set, the row is dropped.
 */
export const IGNORED_HISTORY_FIELDS = new Set([
  'updated_at',
  'updatedat',
  'last_updated_by',
  'created_at',
  'createdat',
  'user_id',
]);

/** Max length for inline description previews before truncation. */
export const DESCRIPTION_PREVIEW_MAX = 120;

/** Strict UUID matcher used to avoid leaking raw 36-char UUIDs in UI labels. */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Canonical field aliases (legacy camelCase → standardized snake_case). */
export const FIELD_ALIASES = {
  stageid: 'stage_id',
  verticalid: 'vertical_id',
  parent_task: 'parent_task_id',
  hubid: 'hub_id',
  assignedto: 'assigned_to',
  createdat: 'created_at',
  updatedat: 'updated_at',
};

/** Human-readable labels for known `tasks` columns. */
export const FIELD_LABELS = {
  stage_id: 'Stage',
  priority: 'Priority',
  assigned_to: 'Assignee',
  hub_id: 'Hub',
  text: 'Title',
  description: 'Description',
  city: 'City',
  function: 'Function',
  vertical_id: 'Vertical',
  parent_task_id: 'Parent Task',
  task_board: 'Board',
  metadata: 'Metadata',
};

/** Default stage ID → display label map derived from TASK_STAGES. */
const DEFAULT_STAGE_LABELS = Object.fromEntries(
  Object.values(TASK_STAGES).map((stage) => [stage.id, stage.label])
);

/** Fallback display names when a UUID cannot be resolved (deleted or RLS-hidden). */
const DELETED_ENTITY_FALLBACKS = {
  user: 'Former Member',
  assignee: 'Former Member',
  employee: 'Former Member',
  hub: 'Deleted Hub',
  client: 'Deleted Client',
  partner: 'Deleted Partner',
  vendor: 'Deleted Vendor',
  task: 'Linked Task',
};

/** Sensitive markers that indicate structured JSON payloads in `description`. */
const SENSITIVE_DESCRIPTION_MARKERS = ['"BANK_UPDATE"', '"EMPLOYEE_DEACTIVATION"'];
const SENSITIVE_JSON_TYPES = new Set(['BANK_UPDATE', 'EMPLOYEE_DEACTIVATION']);

// ---------------------------------------------------------------------------
// Shared Primitives & Lookup Factory
// ---------------------------------------------------------------------------

/** Returns an empty lookupMaps object matching the shared timeline contract. */
export const createEmptyLookupMaps = () => ({
  users: {},
  employees: {},
  hubs: {},
  clients: {},
  partners: {},
  vendors: {},
  tasks: {},
  stages: { ...DEFAULT_STAGE_LABELS },
});

export const isPlainObject = (val) =>
  val !== null && typeof val === 'object' && !Array.isArray(val);

export const isUUID = (val) => typeof val === 'string' && UUID_REGEX.test(val.trim());

export const toSafeEpochMs = (iso) => {
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const canonicalizeField = (key) => FIELD_ALIASES[key] || key;

export const toTitleCaseFromSnake = (str) =>
  String(str || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();

export const getFieldLabel = (canonicalKey) =>
  FIELD_LABELS[canonicalKey] || toTitleCaseFromSnake(canonicalKey);

export const truncateText = (text, maxLen = DESCRIPTION_PREVIEW_MAX) => {
  if (typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
};

export const isEmptyValue = (val) =>
  val === null || val === undefined || (typeof val === 'string' && val.trim() === '');

// ---------------------------------------------------------------------------
// Redaction & Equivalence Guards
// ---------------------------------------------------------------------------

/**
 * Detects whether a description value contains a sensitive structured JSON payload
 * (e.g., bank account update or employee deactivation request) that must never be
 * printed verbatim in the timeline diff.
 */
export const isSensitiveDescription = (val) => {
  if (typeof val !== 'string' || !val.trim()) return false;
  if (SENSITIVE_DESCRIPTION_MARKERS.some((marker) => val.includes(marker))) {
    return true;
  }
  const trimmed = val.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (isPlainObject(parsed)) {
        if (SENSITIVE_JSON_TYPES.has(parsed.type)) return true;
        if ('accountNumber' in parsed || 'ifscCode' in parsed || 'panNumber' in parsed) {
          return true;
        }
      }
    } catch {
      // Not valid JSON; treat as regular description text
    }
  }
  return false;
};

/** Normalizes `task_board` values (array, JSON string, or scalar) into an array of labels. */
const normalizeTaskBoard = (val) => {
  if (Array.isArray(val)) return val.filter(Boolean).map(String);
  if (typeof val === 'string' && val.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {
      // fall through
    }
  }
  return val ? [String(val)] : [];
};

const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
};

/**
 * Deep-ish equality check for JSON values to suppress no-op diffs
 * (e.g., null vs "", identical objects with different key ordering, or stringified vs array task_board).
 */
export const areFieldValuesEquivalent = (canonicalKey, oldVal, newVal) => {
  if (isEmptyValue(oldVal) && isEmptyValue(newVal)) return true;
  if (canonicalKey === 'task_board') {
    const a = normalizeTaskBoard(oldVal);
    const b = normalizeTaskBoard(newVal);
    return a.length === b.length && a.every((v, idx) => v === b[idx]);
  }
  if (oldVal === newVal) return true;
  if (typeof oldVal === 'object' && typeof newVal === 'object' && oldVal !== null && newVal !== null) {
    try {
      return stableStringify(oldVal) === stableStringify(newVal);
    } catch {
      return false;
    }
  }
  return false;
};

// ---------------------------------------------------------------------------
// Entity, Actor & Field Value Formatters
// ---------------------------------------------------------------------------

const shortIdFallback = (id, entityType) => {
  const fallback = DELETED_ENTITY_FALLBACKS[entityType];
  if (fallback) return fallback;
  if (isUUID(id)) return `#${id.slice(0, 6)}`;
  return String(id || 'Unknown');
};

/** Resolves an entity ID to a human-readable display name using `lookupMaps`. */
export const resolveEntityLabel = (entityType, id, lookupMaps) => {
  if (isEmptyValue(id)) return 'None';
  const strId = String(id);
  const maps = lookupMaps || {};

  switch (entityType) {
    case 'stage': {
      const stageMap = { ...DEFAULT_STAGE_LABELS, ...(maps.stages || {}) };
      return stageMap[strId] || toTitleCaseFromSnake(strId);
    }
    case 'assignee':
    case 'employee':
      return maps.employees?.[strId] || maps.users?.[strId] || shortIdFallback(strId, 'assignee');
    case 'user':
      return maps.users?.[strId] || maps.employees?.[strId] || shortIdFallback(strId, 'user');
    case 'hub':
      return maps.hubs?.[strId] || shortIdFallback(strId, 'hub');
    case 'client':
      return maps.clients?.[strId] || shortIdFallback(strId, 'client');
    case 'partner':
      return maps.partners?.[strId] || shortIdFallback(strId, 'partner');
    case 'vendor':
      return maps.vendors?.[strId] || shortIdFallback(strId, 'vendor');
    case 'task':
      return maps.tasks?.[strId] || (isUUID(strId) ? `Task #${strId.slice(0, 6)}` : strId);
    default:
      return isUUID(strId) ? `#${strId.slice(0, 6)}` : strId;
  }
};

/** Resolves the actor display name for a history row or submission. */
export const resolveActorName = ({ actorId, actorName, actorEmail, payload, lookupMaps, currentUser }) => {
  const currentUserId = currentUser?.id ? String(currentUser.id) : null;
  const normalizedActorId = actorId ? String(actorId) : null;

  if (normalizedActorId && currentUserId && normalizedActorId === currentUserId) return 'YOU';
  if (actorName && String(actorName).trim()) return String(actorName).trim();
  if (actorEmail && String(actorEmail).trim()) return String(actorEmail).trim();

  if (normalizedActorId) {
    return lookupMaps?.users?.[normalizedActorId] || lookupMaps?.employees?.[normalizedActorId] || 'Former Member';
  }

  // actor_id === null: automated / system / public support action
  if (payload?.metadata?.source === 'public_support' || payload?.metadata?.is_public_submission) {
    return 'Public Submission';
  }
  return 'System';
};

/** Formats a single field's value into a human-readable string for diffs and summaries. */
export const formatFieldValue = (canonicalKey, rawVal, lookupMaps, { truncate = false } = {}) => {
  if (isEmptyValue(rawVal)) return 'None';

  switch (canonicalKey) {
    case 'stage_id':
      return resolveEntityLabel('stage', rawVal, lookupMaps);
    case 'assigned_to': {
      if (Array.isArray(rawVal)) {
        const names = rawVal.filter(Boolean).map((id) => resolveEntityLabel('assignee', id, lookupMaps));
        return names.length > 0 ? names.join(', ') : 'Unassigned';
      }
      return resolveEntityLabel('assignee', rawVal, lookupMaps);
    }
    case 'hub_id':
      return resolveEntityLabel('hub', rawVal, lookupMaps);
    case 'parent_task_id':
      return resolveEntityLabel('task', rawVal, lookupMaps);
    case 'task_board': {
      const boards = normalizeTaskBoard(rawVal);
      return boards.length > 0 ? boards.join(', ') : 'None';
    }
    case 'description': {
      if (isSensitiveDescription(rawVal)) return 'Structured request details';
      return truncate ? truncateText(String(rawVal)) : String(rawVal).trim();
    }
    case 'metadata':
      return 'Task metadata';
    case 'vertical_id':
      return toTitleCaseFromSnake(String(rawVal).toLowerCase());
    default: {
      if (typeof rawVal === 'boolean') return rawVal ? 'Yes' : 'No';
      if (Array.isArray(rawVal)) return rawVal.length > 0 ? `${rawVal.length} item(s)` : 'None';
      if (isPlainObject(rawVal)) return 'Structured data';
      const str = String(rawVal).trim();
      if (isUUID(str)) return `#${str.slice(0, 6)}`;
      return truncate ? truncateText(str) : str;
    }
  }
};

/** Extracts `entity_type` from a LINK_ADD / LINK_REMOVE history row. */
export const getLinkEntityType = (row) => {
  const payload = row?.action === 'LINK_REMOVE'
    ? (isPlainObject(row.old_payload) ? row.old_payload : {})
    : (isPlainObject(row.new_payload) ? row.new_payload : {});
  return payload.entity_type || 'item';
};

/** Extracts `entity_id` from a LINK_ADD / LINK_REMOVE history row. */
export const getLinkEntityId = (row) => {
  if (row?.entity_id) return String(row.entity_id);
  const payload = row?.action === 'LINK_REMOVE'
    ? (isPlainObject(row.old_payload) ? row.old_payload : {})
    : (isPlainObject(row.new_payload) ? row.new_payload : {});
  return payload.entity_id ? String(payload.entity_id) : null;
};

/** Pluralizes an entity type cleanly for multi-link summaries. */
export const pluralizeEntityType = (entityType, count) => {
  const base = String(entityType || 'item').toLowerCase();
  if (count === 1 || base.endsWith('s')) return base;
  return `${base}s`;
};
