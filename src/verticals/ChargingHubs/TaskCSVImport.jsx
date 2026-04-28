import React from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/core/supabaseClient';
import { STAGE_LIST } from '../../constants/stages';

/**
 * TaskCSVImport — Thin Wrapper
 *
 * Defines task-specific import rules:
 *   - Conflict key: text + hub_code + function_code
 *   - Pre-processes hub/function codes to DB IDs and applies automatic prefixes
 *   - Finalizes with Supabase upsert
 *
 * All duplicate detection (in-file + DB) is handled by CSVImportButton.
 */
const TaskCSVImport = ({ verticalId, onImportComplete, className }) => {
  const dbVerticalId = ['CHARGING_HUBS', 'hub_tasks', 'daily_hub_tasks'].includes(verticalId) ? 'CHARGING_HUBS' : verticalId;
  const [importing, setImporting] = React.useState(false);
  const [importContext, setImportContext] = React.useState(null); // { hubCodeMap, hubNameMap, funcCodeMap, existingTasks }

  // Pre-load resolution maps and existing tasks for conflict checking
  const loadImportContext = async () => {
    if (importContext) return importContext;
    const [{ data: hubs }, { data: functions }, { data: employees }, { data: existingTasks }] = await Promise.all([
      supabase.from('hubs').select('id, hub_code, name, city'),
      supabase.from('hub_functions').select('name, function_code'),
      supabase.from('employees').select('id, full_name, emp_code').eq('status', 'Active'),
      supabase.from('tasks').select('id, text, hub_id, function, task_board')
        .or(`vertical_id.eq.${dbVerticalId},task_board.cs.["Hubs Daily"]`)
    ]);

    // Added robust case-insensitive mapping for hub and function codes
    const hubCodeMap = Object.fromEntries(hubs?.map(h => [h.hub_code?.toLowerCase().trim(), h.id]).filter(([k]) => k) || []);
    const hubNameMap = Object.fromEntries(hubs?.map(h => [h.id, h.hub_code || h.name]) || []);
    const funcCodeMap = Object.fromEntries(functions?.map(f => [f.function_code?.toLowerCase().trim(), f.name]).filter(([k]) => k) || []);
    const hubCityMap = Object.fromEntries(hubs?.map(h => [h.hub_code?.toLowerCase().trim(), h.city]).filter(([k]) => k) || []);
    const hubCityMapById = Object.fromEntries(hubs?.map(h => [h.id, h.city]) || []);
    
    // Create maps for employee lookup by exact name, lowercase name, and emp_code
    const empMap = {};
    employees?.forEach(e => {
      empMap[e.full_name] = e.id;
      empMap[e.full_name.toLowerCase()] = e.id;
      if (e.emp_code) empMap[e.emp_code] = e.id;
    });

    const ctx = { hubCodeMap, hubNameMap, funcCodeMap, empMap, hubCityMap, hubCityMapById, existingTasks: existingTasks || [] };
    setImportContext(ctx);
    return ctx;
  };

  // Load context on mount to ensure reference data is available before user interaction
  React.useEffect(() => {
    loadImportContext().catch(err => console.error('Mount load failed:', err));
  }, []);

  const handleFileOpen = async () => {
    if (importContext) return; // Prevent duplicate loading if already cached
    setImporting(true);
    try {
      await loadImportContext();
    } catch (err) {
      console.error('Failed to load import context:', err);
      alert(`Could not load reference data: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  // Defines task uniqueness for in-file AND db dedup: same text + hub + function
  // Normalize conflict key values to be case-insensitive and trimmed
  const getConflictKey = (row) => {
    const rawSubject = row.hub_code || row.hub_id || row.client_id || row.employee_id || row.partner_id || row.vendor_id || '';
    const subject = rawSubject.toString().toLowerCase().trim();
    const rawFunc = row.function_code || row.function || '';
    const func = rawFunc.toString().toLowerCase().trim();
    return `${(row.text || '').toLowerCase().trim()}|${subject}|${func}`;
  };

  // Renders a conflict tile in the modal
  const renderConflictTile = (conflict) => {
    const existing = conflict.existingRecord;
    const stage = STAGE_LIST.find(s => s.id === existing?.stage_id || s.id === existing?.stageId);
    return (
      <div className="tile-content">
        <h5 style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--brand-green)' }}>
          {conflict.csvRow.text}
        </h5>
        <div style={{ fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.4 }}>
          <strong>Hub:</strong> {conflict.csvRow.hub_code || 'N/A'}<br />
          <strong>Function:</strong> {conflict.csvRow.function_code || 'N/A'}<br />
          <em style={{ fontSize: '0.7rem' }}>Status: {stage?.label || existing?.stage_id || 'Unknown'}</em>
        </div>
      </div>
    );
  };

  // Normalize existingTasks to use getConflictKey-compatible keys
  const normalizeExistingForConflict = (ctx) => {
    return ctx.existingTasks.map(t => ({
      ...t,
      hub_code: Object.keys(ctx.hubCodeMap).find(code => ctx.hubCodeMap[code] === t.hub_id) || '',
      function_code: t.function || '',
    }));
  };

  // Final upsert after conflict resolution
  const handleDataParsed = async (rows) => {
    setImporting(true);
    try {
      const ctx = await loadImportContext();
      const { hubCodeMap, hubNameMap, funcCodeMap, empMap, hubCityMap, hubCityMapById } = ctx;

      // BUG-FIX: Safe session fetch — direct destructure of { data: { session } }
      // crashes if data is null/undefined (can happen on network error or auth timeout).
      const sessionResult = await supabase.auth.getSession();
      const userId = sessionResult?.data?.session?.user?.id || null;

      const operations = rows.map(row => {
        let finalTaskText = row.text?.trim() || 'Untitled Task';
        // Resolve codes with case-insensitive lookups
        const resolvedHubId = hubCodeMap[String(row.hub_code || '').toLowerCase().trim()] || null;
        const resolvedFunc = funcCodeMap[String(row.function_code || '').toLowerCase().trim()] || row.function || null;
        const funcLower = resolvedFunc?.toLowerCase();

        // Apply automatic prefix
        if (funcLower === 'hiring') {
          const prefix = 'Hire : ';
          if (!finalTaskText.startsWith(prefix)) finalTaskText = `${prefix}${finalTaskText}`;
        } else if (funcLower === 'facility' && resolvedHubId) {
          const hubName = hubNameMap[resolvedHubId] || 'Hub';
          const prefix = `${hubName} : `;
          if (!finalTaskText.startsWith(prefix)) finalTaskText = `${prefix}${finalTaskText}`;
        }

        // Attach existing ID if this row came from conflict resolution
        const existingMatch = ctx.existingTasks.find(t =>
          getConflictKey({ 
            text: t.text, 
            hub_code: Object.keys(hubCodeMap).find(c => hubCodeMap[c] === t.hub_id) || 
                       (t.client_id?.length ? t.client_id[0] : null) || 
                       (t.employee_id?.length ? t.employee_id[0] : null) || 
                       (t.partner_id?.length ? t.partner_id[0] : null) || 
                       (t.vendor_id?.length ? t.vendor_id[0] : null) || '', 
            function_code: (t.function || t.function_name) || '',
            vertical_id: t.verticalId || t.vertical_id || dbVerticalId
          }) === getConflictKey(row)
        );

        const isDaily = verticalId === 'daily_hub_tasks';
        let parsedTaskBoard = isDaily ? ['Hubs Daily'] : ['Hubs'];
        if (row.task_board) {
          if (typeof row.task_board === 'string') {
            try {
              const cleanStr = row.task_board.trim();
              if (cleanStr.startsWith('[')) {
                const parsed = JSON.parse(cleanStr);
                parsedTaskBoard = Array.isArray(parsed) ? parsed : [row.task_board];
              } else {
                parsedTaskBoard = [cleanStr];
              }
            } catch (e) {
              parsedTaskBoard = [row.task_board.trim()];
            }
          } else if (Array.isArray(row.task_board)) {
            parsedTaskBoard = row.task_board;
          }
        }

        const resolvedAssignee = row.assigned_to ? (empMap[row.assigned_to] || empMap[row.assigned_to.toLowerCase()] || null) : null;

        const taskRow = {
          id: existingMatch?.id || row.id || crypto.randomUUID(),
          text: finalTaskText,
          description: row.description || null,
          priority: row.priority || 'Medium',
          hub_id: resolvedHubId,
          city: hubCityMap[String(row.hub_code || '').toLowerCase().trim()] || hubCityMapById[resolvedHubId] || row.city || null,
          assigned_to: resolvedAssignee,
          // FIX: Populate created_at for genuinely new rows. Omitted for upserts over existing tasks
          // so we don't overwrite the original creation timestamp on conflict resolution.
          ...(!existingMatch?.id && { created_at: new Date().toISOString() }),
          updated_at: new Date().toISOString(),
          vertical_id: dbVerticalId,
          stage_id: row.stageid || row.stage_id || 'BACKLOG',
          function: resolvedFunc,
          task_board: parsedTaskBoard,
        };

        const contextLinks = {};
        if (resolvedHubId) contextLinks.hub = [resolvedHubId];
        if (resolvedAssignee) contextLinks.assignee = [resolvedAssignee];

        return {
          task_data: taskRow,
          context_links: contextLinks,
          fan_out_targets: null
        };
      });

      // PERF-FIX: Chunk large imports to avoid Supabase's default 30s statement
      // timeout. Each chunk is an independent atomic transaction. If a chunk fails,
      // we report exactly how many tasks were already committed so the user can
      // safely retry only the remaining rows without creating duplicates (the RPC
      // uses ON CONFLICT DO UPDATE so re-submitting committed rows is idempotent).
      const CHUNK_SIZE = 100;
      const allCreatedIds = [];
      let failedChunkIndex = -1;
      let chunkError = null;

      for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
        const chunk = operations.slice(i, i + CHUNK_SIZE);
        const payload = { audit_user_id: userId, operations: chunk };

        const { data: chunkIds, error } = await supabase.rpc('rpc_orchestrate_tasks', { payload });

        if (error) {
          failedChunkIndex = Math.floor(i / CHUNK_SIZE);
          chunkError = error;
          break; // Stop processing; report partial success below
        }

        if (chunkIds) allCreatedIds.push(...chunkIds);
      }

      if (chunkError) {
        const committedCount = allCreatedIds.length;
        const remainingCount = operations.length - committedCount;
        console.error('[TaskCSVImport] Chunk failure:', chunkError);
        alert(
          `Partial import: ${committedCount} of ${operations.length} tasks were saved successfully.\n` +
          `${remainingCount} tasks failed (starting at row ~${allCreatedIds.length + 1}).\n\n` +
          `Error: ${chunkError.message}\n\n` +
          `The saved tasks are already in the database. You can safely re-import only the remaining rows.`
        );
        // Still call onImportComplete for the tasks that did succeed
        if (committedCount > 0 && onImportComplete) onImportComplete();
        return;
      }

      alert(`Successfully processed ${allCreatedIds.length} tasks.`);
      if (onImportComplete) onImportComplete();
    } catch (err) {
      console.error('Finalize Error:', err);
      alert(`Failed to finalize import: ${err.message}`);
    } finally {
      setImporting(false);
      // FIX Issue-8: Always reset context so the next import re-fetches fresh existingTasks.
      // Previously this only ran on success, leaving stale context after a partial-chunk failure
      // and silently skipping conflict detection for newly committed rows.
      setImportContext(null);
    }
  };

  return (
    <CSVImportButton
      label={importing ? 'Importing...' : 'Import Tasks'}
      onDataParsed={handleDataParsed}
      requiredFields={['text']}
      getConflictKey={getConflictKey}
      existingData={importContext ? normalizeExistingForConflict(importContext) : null}
      renderConflictTile={renderConflictTile}
      entityName="Tasks"
      className={className}
      disabled={importing}
      onFocus={handleFileOpen}
    />
  );
};

export default TaskCSVImport;
