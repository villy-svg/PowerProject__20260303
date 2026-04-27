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
  const [importing, setImporting] = React.useState(false);
  const [importContext, setImportContext] = React.useState(null); // { hubCodeMap, hubNameMap, funcCodeMap, existingTasks }

  // Pre-load resolution maps and existing tasks for conflict checking
  const loadImportContext = async () => {
    if (importContext) return importContext;
    const [{ data: hubs }, { data: functions }, { data: employees }, { data: existingTasks }] = await Promise.all([
      supabase.from('hubs').select('id, hub_code, name'),
      supabase.from('hub_functions').select('name, function_code'),
      supabase.from('employees').select('id, full_name, emp_code').eq('status', 'Active'),
      supabase.from('tasks').select('id, text, hub_id, function, task_board')
        .or(`vertical_id.eq.${verticalId},task_board.cs.["Hubs Daily"]`)
    ]);

    const hubCodeMap = Object.fromEntries(hubs?.map(h => [h.hub_code, h.id]) || []);
    const hubNameMap = Object.fromEntries(hubs?.map(h => [h.id, h.hub_code || h.name]) || []);
    const funcCodeMap = Object.fromEntries(functions?.map(f => [f.function_code, f.name]) || []);
    
    // Create maps for employee lookup by exact name, lowercase name, and emp_code
    const empMap = {};
    employees?.forEach(e => {
      empMap[e.full_name] = e.id;
      empMap[e.full_name.toLowerCase()] = e.id;
      if (e.emp_code) empMap[e.emp_code] = e.id;
    });

    const ctx = { hubCodeMap, hubNameMap, funcCodeMap, empMap, existingTasks: existingTasks || [] };
    setImportContext(ctx);
    return ctx;
  };

  const handleFileOpen = async () => {
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
  const getConflictKey = (row) => {
    const subject = row.hub_code || row.hub_id || row.client_id || row.employee_id || row.partner_id || row.vendor_id || '';
    const func = row.function_code || row.function || '';
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
      const { hubCodeMap, hubNameMap, funcCodeMap, empMap } = ctx;

      const tasksToInsert = rows.map(row => {
        let finalTaskText = row.text?.trim() || 'Untitled Task';
        const resolvedHubId = hubCodeMap[row.hub_code] || null;
        const resolvedFunc = funcCodeMap[row.function_code] || row.function || null;
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
            vertical_id: t.verticalId || t.vertical_id || verticalId
          }) === getConflictKey(row)
        );

        const isDaily = verticalId === 'daily_hub_tasks';
        const taskRow = {
          id: existingMatch?.id || row.id || crypto.randomUUID(),
          text: finalTaskText,
          description: row.description || null,
          priority: row.priority || 'Medium',
          hub_id: resolvedHubId,
          city: row.city || null,
          assigned_to: row.assigned_to ? (empMap[row.assigned_to] || empMap[row.assigned_to.toLowerCase()] || null) : null,
          updated_at: new Date().toISOString(),
          vertical_id: verticalId,
          stage_id: row.stageid || row.stage_id || 'BACKLOG',
          function: resolvedFunc,
        };

        if (isDaily) {
          taskRow.task_board = ['Hubs Daily'];
        }

        return taskRow;
      });

      const { error } = await supabase
        .from('tasks')
        .upsert(tasksToInsert, { onConflict: 'id' });

      if (error) throw error;

      alert(`Successfully processed ${tasksToInsert.length} tasks.`);
      setImportContext(null); // Reset context for next import
      if (onImportComplete) onImportComplete();
    } catch (err) {
      console.error('Finalize Error:', err);
      alert(`Failed to finalize import: ${err.message}`);
    } finally {
      setImporting(false);
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
