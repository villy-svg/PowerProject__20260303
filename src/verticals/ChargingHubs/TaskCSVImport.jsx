import React, { useState } from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/supabaseClient';

/**
 * TaskCSVImport
 * Handles uploading tasks from CSV for Charging Hubs.
 * Resolves codes back to database IDs.
 */
const TaskCSVImport = ({ verticalId, onImportComplete, className }) => {
  const [importing, setImporting] = useState(false);

  const handleDataParsed = async (rows) => {
    setImporting(true);
    try {
      // 1. Fetch Hubs and Functions for resolution
      const [{ data: hubs }, { data: functions }] = await Promise.all([
        supabase.from('hubs').select('id, hub_code'),
        supabase.from('hub_functions').select('name, function_code')
      ]);

      const hubCodeMap = Object.fromEntries(hubs?.map(h => [h.hub_code, h.id]) || []);
      const funcCodeMap = Object.fromEntries(functions?.map(f => [f.function_code, f.name]) || []);

      // 2. Map rows to DB schema
      const tasksToInsert = rows.map(row => ({
        text: row.text,
        verticalid: verticalId,
        stageid: row.stageId || 'BACKLOG',
        priority: row.priority || 'Medium',
        description: row.description || null,
        hub_id: hubCodeMap[row.hub_code] || null,
        function: funcCodeMap[row.function_code] || row.function_code || null,
        city: row.city || null,
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      }));

      // 3. Insert into Supabase
      const { error } = await supabase.from('tasks').insert(tasksToInsert);

      if (error) throw error;

      alert(`Successfully imported ${tasksToInsert.length} tasks.`);
      if (onImportComplete) onImportComplete();
    } catch (err) {
      console.error("Import Error:", err);
      alert(`Failed to import tasks: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <CSVImportButton 
      label={importing ? "Importing..." : "Import Tasks"}
      onDataParsed={handleDataParsed}
      requiredFields={['text']}
      className={className}
      disabled={importing}
    />
  );
};

export default TaskCSVImport;
