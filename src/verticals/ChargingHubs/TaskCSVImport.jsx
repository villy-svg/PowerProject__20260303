import React from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/supabaseClient';
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
    const [{ data: hubs }, { data: functions }, { data: existingTasks }] = await Promise.all([
      supabase.from('hubs').select('id, hub_code, name'),
      supabase.from('hub_functions').select('name, function_code'),
      supabase.from('tasks').select('id, text, hub_id, function').eq('verticalid', verticalId)
    ]);

    const hubCodeMap = Object.fromEntries(hubs?.map(h => [h.hub_code, h.id]) || []);
    const hubNameMap = Object.fromEntries(hubs?.map(h => [h.id, h.hub_code || h.name]) || []);
    const funcCodeMap = Object.fromEntries(functions?.map(f => [f.function_code, f.name]) || []);

    const ctx = { hubCodeMap, hubNameMap, funcCodeMap, existingTasks: existingTasks || [] };
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
    const hub = row.hub_code || row.hub_id || '';
    const func = row.function_code || row.function || '';
    return `${(row.text || '').toLowerCase().trim()}|${hub}|${func}`;
  };

  // Renders a conflict tile in the modal
  const renderConflictTile = (conflict) => {
    const existing = conflict.existingRecord;
    const stage = STAGE_LIST.find(s => s.id === existing?.stageid || s.id === existing?.stageId);
    return (
      <div className="tile-content">
        <h5 style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--brand-green)' }}>
          {conflict.csvRow.text}
        </h5>
        <div style={{ fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.4 }}>
          <strong>Hub:</strong> {conflict.csvRow.hub_code || 'N/A'}<br />
          <strong>Function:</strong> {conflict.csvRow.function_code || 'N/A'}<br />
          <em style={{ fontSize: '0.7rem' }}>Status: {stage?.label || existing?.stageid || 'Unknown'}</em>
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
      const { hubCodeMap, hubNameMap, funcCodeMap } = ctx;

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
          getConflictKey({ text: t.text, hub_code: Object.keys(hubCodeMap).find(c => hubCodeMap[c] === t.hub_id) || '', function_code: t.function || '' }) ===
          getConflictKey(row)
        );

        return {
          id: existingMatch?.id || row.id || crypto.randomUUID(),
          text: finalTaskText,
          verticalid: verticalId,
          stageid: row.stageid || 'BACKLOG',
          priority: row.priority || 'Medium',
          description: row.description || null,
          hub_id: resolvedHubId,
          function: resolvedFunc,
          city: row.city || null,
          updatedat: new Date().toISOString(),
        };
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
