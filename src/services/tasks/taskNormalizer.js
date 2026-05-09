/**
 * taskNormalizer.js
 * Pure mapping functions between Supabase DB row shape and the app's camelCase task shape.
 * No side effects. No Supabase imports.
 *
 * Canonical location: src/services/tasks/taskNormalizer.js
 */

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * parseTaskBoard — normalizes task_board to always be an array.
 * Handles: array (passthrough), JSON string ('[...]'), scalar string, null.
 */
const parseTaskBoard = (boardData) => {
  if (Array.isArray(boardData)) return boardData;
  if (typeof boardData === 'string' && boardData.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(boardData);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) { /* fall through */ }
  }
  return boardData ? [boardData] : [];
};

// ─────────────────────────────────────────────────────────────────────────────
// PostgREST SELECT string
// Used in every Supabase query that fetches tasks with their joined relations.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TASK_SELECT — The Supabase PostgREST select string for fully-hydrated tasks.
 * Includes: assignees, hubs, clients, employees, submissions, children.
 */
export const TASK_SELECT = `
  *,
  assignees(id, full_name, badge_id, employee_roles(seniority_level)),
  hubs(id, name, hub_code, city),
  clients(id, name),
  employees(id, full_name),
  submissions(id, status, rejection_reason, submission_number, created_at, submitted_by),
  children:tasks!parent_task_id(id)
`;

// ─────────────────────────────────────────────────────────────────────────────
// normalizeTask
// ─────────────────────────────────────────────────────────────────────────────

/**
 * normalizeTask(row)
 * Maps a Supabase DB row (snake_case) to the camelCase shape the app expects.
 * Handles optional joined employee data, multi-hub, multi-assignee, submissions.
 *
 * @param {object} row - Raw Supabase row from tasks table with joins
 * @returns {object} Normalized task in app camelCase shape
 */
export const normalizeTask = (row) => {
  // Submissions: sort by submission_number desc, take latest
  const submissions = Array.isArray(row.submissions) ? row.submissions : [];
  const latestSubmission = submissions.length > 0
    ? [...submissions].sort((a, b) => (b.submission_number || 0) - (a.submission_number || 0))[0]
    : null;

  // Multi-hub data
  const rawHubs = Array.isArray(row.hubs) ? row.hubs : (row.hubs ? [row.hubs] : []);
  const hubData = rawHubs.filter(Boolean);

  // Assignee data (PostgREST returns via 'assignees' computed relationship)
  const rawAssignees = Array.isArray(row.assignees)
    ? row.assignees
    : (row.assignees ? [row.assignees] : []);
  const validAssignees = rawAssignees.filter(Boolean);

  const assigneeNames = validAssignees.map(e => e.full_name).filter(Boolean).join(', ');

  // Flatten nested employee_roles seniority_level for each assignee
  const assigneeMeta = validAssignees.map(e => ({
    ...e,
    seniority_level: e?.employee_roles?.seniority_level || 1,
  }));

  return {
    id: row.id,
    text: row.text,
    verticalId: row.vertical_id,
    stageId: row.stage_id,
    priority: row.priority,
    description: row.description,

    // Hub Relationships
    hub_id: row.hub_id,
    hub_ids: hubData.map(h => h.id).filter(Boolean),
    hubNames: hubData.map(h => h.name).filter(Boolean),
    hubCodes: hubData.map(h => h.hub_code).filter(Boolean),
    hubData: hubData,
    city: row.city,

    function: row.function,

    // Assignee Relationships
    assigned_to: validAssignees.length > 0
      ? validAssignees.map(a => a.id).filter(Boolean)
      : (Array.isArray(row.assigned_to) ? row.assigned_to : (row.assigned_to ? [row.assigned_to] : [])),
    assigneeName: assigneeNames,
    assigneeMeta,

    // Hierarchy
    parentTask: row.parent_task_id || null,
    childCount: row.children?.length || 0,
    isSubTask: !!row.parent_task_id,

    // Meta & Audit
    task_board: parseTaskBoard(row.task_board),
    isDailyTask: parseTaskBoard(row.task_board).includes('Hubs Daily'),

    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    lastUpdatedBy: row.last_updated_by,

    // Entity Links
    client_id: Array.isArray(row.clients)
      ? row.clients.map(c => c?.id).filter(Boolean)
      : (row.metadata?.entity_links?.client_id || []),
    employee_id: Array.isArray(row.employees)
      ? row.employees.map(e => e?.id).filter(Boolean)
      : (row.metadata?.entity_links?.employee_id || []),
    partner_id: row.metadata?.entity_links?.partner_id || [],
    vendor_id: row.metadata?.entity_links?.vendor_id || [],

    latestSubmission,
    submissionBy: latestSubmission?.submitted_by || row.metadata?.submission_by,
    metadata: row.metadata || {},
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// mapTaskToRow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * mapTaskToRow(task)
 * Maps the app's camelCase task shape back to Supabase DB column names for inserts/updates.
 *
 * CONTRACT NOTE: tasks.assigned_to is a SCALAR UUID in the DB column.
 * It stores only the primary (first) assignee for legacy compatibility.
 * Multi-assignee relationships live exclusively in task_context_links.
 * Do NOT use tasks.assigned_to for multi-assignee logic.
 *
 * @param {object} task - App camelCase task shape
 * @returns {object} DB snake_case row shape
 */
export const mapTaskToRow = (task) => ({
  text: task.text,
  vertical_id: task.verticalId,
  stage_id: task.stageId,
  priority: task.priority || null,
  description: task.description || null,
  hub_id: task.hub_id === '' ? null : (task.hub_id || null),
  city: task.city || null,
  function: task.function || null,
  assigned_to: Array.isArray(task.assigned_to)
    ? task.assigned_to[0]
    : (task.assigned_to || null),
  parent_task_id: task.parentTask || null,
  last_updated_by: task.lastUpdatedBy || null,
  task_board: task.task_board || [],
  metadata: {
    ...(task.metadata || {}),
    entity_links: {
      client_id: Array.isArray(task.client_id)
        ? task.client_id
        : (task.client_id ? [task.client_id] : []),
      partner_id: Array.isArray(task.partner_id)
        ? task.partner_id
        : (task.partner_id ? [task.partner_id] : []),
      vendor_id: Array.isArray(task.vendor_id)
        ? task.vendor_id
        : (task.vendor_id ? [task.vendor_id] : []),
      employee_id: Array.isArray(task.employee_id)
        ? task.employee_id
        : (task.employee_id ? [task.employee_id] : []),
    },
    submission_by: task.submissionBy || null,
  },
});
