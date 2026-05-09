/**
 * taskFixService.js
 * Admin-only tool: scans all tasks and repairs incorrect field values in bulk.
 * Extracted from taskService.js to keep the CRUD service focused.
 *
 * Canonical location: src/services/tasks/taskFixService.js
 * Called by: src/components/FixTasksButton.jsx
 */
import { supabase } from '../core/supabaseClient';

const VALID_VERTICALS = [
  'CHARGING_HUBS', 'CLIENTS', 'EMPLOYEES',
  'PARTNERS', 'VENDORS', 'DATA_MANAGER',
];
const CHUNK_SIZE = 100;

/**
 * fixAllTasks()
 * Scans every task in the DB and fixes:
 *   A. Invalid vertical_id values
 *   B. Missing or malformed task_board arrays
 *   C. Missing city (derived from hub_id)
 *   D. Null stage_id (defaults to 'TODO')
 *   E. Null priority (defaults to 'Medium')
 *   F. Missing hub context links in task_context_links
 *
 * Uses batched upserts to avoid N+1 DB calls.
 * @returns {number} count of fixed records
 */
export async function fixAllTasks() {
  // 1. Fetch ALL tasks (raw, no joins needed)
  const { data: allTasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*');
  if (tasksError) throw tasksError;

  // 2. Fetch ALL hubs for city mapping
  const { data: allHubs, error: hubsError } = await supabase
    .from('hubs')
    .select('id, city');
  if (hubsError) throw hubsError;

  const hubCityMap = (allHubs || []).reduce((acc, hub) => {
    if (hub.id && hub.city) acc[hub.id] = hub.city;
    return acc;
  }, {});

  // 3. Fetch all existing hub context links for dedup
  const { data: existingLinks } = await supabase
    .from('task_context_links')
    .select('source_id, entity_id')
    .eq('source_type', 'task')
    .eq('entity_type', 'hub');

  const linkedSet = new Set(
    (existingLinks || []).map(l => `${l.source_id}::${l.entity_id}`)
  );

  // 4. Collect patches
  const taskPatches = [];
  const newLinkRows = [];

  for (const task of (allTasks || [])) {
    const patch = { id: task.id };
    let hasPatch = false;

    // Parse stringified task_board
    let taskBoard = task.task_board;
    if (typeof taskBoard === 'string' && taskBoard.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(taskBoard);
        if (Array.isArray(parsed)) {
          taskBoard = parsed;
          patch.task_board = taskBoard;
          hasPatch = true;
        }
      } catch (e) { /* skip */ }
    }

    const boards = Array.isArray(taskBoard) ? taskBoard : [];

    // A. Fix vertical_id
    const currentVid = (task.vertical_id || '').toUpperCase();
    let correctVid = task.vertical_id;
    if (!VALID_VERTICALS.includes(currentVid)) {
      hasPatch = true;
      if (boards.includes('Hubs') || boards.includes('Hubs Daily') || task.hub_id) {
        correctVid = 'CHARGING_HUBS';
      } else if (boards.includes('Clients')) {
        correctVid = 'CLIENTS';
      } else if (boards.includes('Employees')) {
        correctVid = 'EMPLOYEES';
      } else {
        correctVid = 'CHARGING_HUBS';
      }
      patch.vertical_id = correctVid;
    }

    // B. Fix task_board
    if (boards.length === 0) {
      hasPatch = true;
      const vidCheck = (correctVid || task.vertical_id || '').toLowerCase();
      if (vidCheck.includes('hub'))      patch.task_board = ['Hubs'];
      else if (vidCheck.includes('client'))   patch.task_board = ['Clients'];
      else if (vidCheck.includes('employee')) patch.task_board = ['Employees'];
      else                                     patch.task_board = ['Hubs'];
    }

    // C. Fix city from hub_id
    if (!task.city && task.hub_id) {
      const mappedCity = hubCityMap[task.hub_id];
      if (mappedCity) { hasPatch = true; patch.city = mappedCity; }
    }

    // D. Fix stage_id
    if (!task.stage_id) { hasPatch = true; patch.stage_id = 'TODO'; }

    // E. Fix priority
    if (!task.priority) { hasPatch = true; patch.priority = 'Medium'; }

    if (hasPatch) taskPatches.push(patch);

    // F. Collect missing hub context links
    if (task.hub_id && !linkedSet.has(`${task.id}::${task.hub_id}`)) {
      newLinkRows.push({
        source_id: task.id, source_type: 'task',
        entity_type: 'hub', entity_id: task.hub_id,
      });
      linkedSet.add(`${task.id}::${task.hub_id}`);
    }
  }

  // 5. Bulk upsert task patches in chunks
  let updateCount = 0;
  for (let i = 0; i < taskPatches.length; i += CHUNK_SIZE) {
    const chunk = taskPatches.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('tasks').upsert(chunk, { onConflict: 'id' });
    if (error) console.error('[taskFixService] upsert error:', error);
    else updateCount += chunk.length;
  }

  // 6. Insert missing hub context links in chunks
  for (let i = 0; i < newLinkRows.length; i += CHUNK_SIZE) {
    const chunk = newLinkRows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('task_context_links').insert(chunk);
    if (error) console.error('[taskFixService] link insert error:', error);
    else updateCount += chunk.length;
  }

  return updateCount;
}
