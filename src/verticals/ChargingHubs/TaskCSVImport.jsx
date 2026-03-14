import React, { useState } from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/supabaseClient';
import CSVConflictModal from '../../components/CSVConflictModal';
import { STAGE_LIST } from '../../constants/stages';

/**
 * TaskCSVImport
 * Handles uploading tasks from CSV for Charging Hubs.
 * Resolves codes back to database IDs.
 */
const TaskCSVImport = ({ verticalId, onImportComplete, className }) => {
  const [importing, setImporting] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [pendingData, setPendingData] = useState({
    conflicts: [],
    nonConflictingRows: [],
    hubCodeMap: {},
    funcCodeMap: {}
  });

  const handleDataParsed = async (rows) => {
    setImporting(true);
    try {
      // 1. Fetch resolution maps (Hubs/Functions) and existing Tasks for conflict checking
      const [{ data: hubs }, { data: functions }, { data: existingTasks }] = await Promise.all([
        supabase.from('hubs').select('id, hub_code'),
        supabase.from('hub_functions').select('name, function_code'),
        supabase.from('tasks').select('*').eq('verticalId', verticalId)
      ]);

      const hubCodeMap = Object.fromEntries(hubs?.map(h => [h.hub_code, h.id]) || []);
      const funcCodeMap = Object.fromEntries(functions?.map(f => [f.function_code, f.name]) || []);

      const conflicts = [];
      const nonConflictingRows = [];

      rows.forEach(row => {
        const resolvedHubId = hubCodeMap[row.hub_code] || null;
        const resolvedFunc = funcCodeMap[row.function_code] || row.function || null;
        
        // Find existing task with same key attributes
        const existing = existingTasks?.find(t => 
          t.text?.toLowerCase() === row.text?.toLowerCase() &&
          t.hub_id === resolvedHubId &&
          t.function === resolvedFunc
        );

        if (existing) {
          conflicts.push({ csvRow: row, existingTask: existing });
        } else {
          nonConflictingRows.push(row);
        }
      });

      if (conflicts.length > 0) {
        setPendingData({ conflicts, nonConflictingRows, hubCodeMap, funcCodeMap });
        setShowConflicts(true);
      } else {
        await finalizeImport(rows, hubCodeMap, funcCodeMap);
      }
    } catch (err) {
      console.error("Import Error:", err);
      alert(`Failed to check conflicts: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleResolveConflicts = async (selectedCsvRowsToUpdate) => {
    setShowConflicts(false);
    setImporting(true);
    
    const finalDataToProcess = [
      ...pendingData.nonConflictingRows,
      ...selectedCsvRowsToUpdate
    ];

    if (finalDataToProcess.length === 0) {
      setImporting(false);
      return;
    }
    
    await finalizeImport(finalDataToProcess, pendingData.hubCodeMap, pendingData.funcCodeMap);
  };

  const finalizeImport = async (rows, hubCodeMap, funcCodeMap) => {
    try {
      const tasksToInsert = rows.map(row => ({
        text: row.text,
        verticalid: verticalId,
        stageid: row.stageid || 'BACKLOG',
        priority: row.priority || 'Medium',
        description: row.description || null,
        hub_id: hubCodeMap[row.hub_code] || null,
        function: funcCodeMap[row.function_code] || row.function_code || null,
        city: row.city || null,
        updatedat: new Date().toISOString()
      }));

      // Use upsert to handle updates if text+hub+func matches (requires unique constraint in DB if strictly enforcing, 
      // but here we manually filtered so insert is safe, or upsert for logic consistency)
      const { error } = await supabase
        .from('tasks')
        .upsert(tasksToInsert, { onConflict: 'text,verticalId,hub_id,function' });

      if (error) throw error;

      alert(`Successfully processed ${tasksToInsert.length} tasks.`);
      if (onImportComplete) onImportComplete();
    } catch (err) {
      console.error("Finalize Error:", err);
      alert(`Failed to finalize import: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  // Conflict tile renderer
  const renderTaskConflictTile = (conflict) => {
    const stage = STAGE_LIST.find(s => s.id === conflict.existingTask.stageId);
    return (
      <div className="tile-content">
        <h5 style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--brand-green)' }}>
          {conflict.csvRow.text}
        </h5>
        <div style={{ fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.4 }}>
          <strong>Hub:</strong> {conflict.csvRow.hub_code || 'N/A'}<br/>
          <strong>Function:</strong> {conflict.csvRow.function_code || 'N/A'}<br/>
          <em style={{fontSize: '0.7rem'}}>Status: {stage?.label || conflict.existingTask.stageId}</em>
        </div>
      </div>
    );
  };

  return (
    <>
      <CSVImportButton 
        label={importing ? "Importing..." : "Import Tasks"}
        onDataParsed={handleDataParsed}
        requiredFields={['text']}
        className={className}
        disabled={importing}
      />

      {showConflicts && (
        <CSVConflictModal 
          entityName="Tasks"
          conflicts={pendingData.conflicts}
          onResolve={handleResolveConflicts}
          onCancel={() => setShowConflicts(false)}
          renderConflictTile={renderTaskConflictTile}
        />
      )}
    </>
  );
};

export default TaskCSVImport;
