import React from 'react';
import CSVDownloadButton from '../../components/CSVDownloadButton';
import { supabase } from '../../services/supabaseClient';

/**
 * TaskCSVDownload
 * Specialized CSV exporter for Charging Hubs vertical.
 * Resolves hub_id and function names to codes before export.
 */
const TaskCSVDownload = ({ data = [], label = 'Export Tasks', filename, isTemplate = false }) => {
  const headers = ['text', 'priority', 'stageId', 'hub_code', 'function_code', 'description', 'city'];

  const handleExport = async () => {
    if (isTemplate) return;

    // Fetch Hubs and Functions for code resolution
    const [{ data: hubs }, { data: functions }] = await Promise.all([
      supabase.from('hubs').select('id, hub_code'),
      supabase.from('hub_functions').select('name, function_code')
    ]);

    const hubMap = Object.fromEntries(hubs?.map(h => [h.id, h.hub_code]) || []);
    const funcMap = Object.fromEntries(functions?.map(f => [f.name, f.function_code]) || []);

    const resolvedData = data.map(task => ({
      text: task.text,
      priority: task.priority || '',
      stageId: task.stageId,
      hub_code: hubMap[task.hub_id] || task.hub_id || '',
      function_code: funcMap[task.function] || task.function || '',
      description: task.description || '',
      city: task.city || ''
    }));

    return resolvedData;
  };

  const sampleRows = isTemplate ? [{
    text: 'Install new firmware',
    priority: 'High',
    stageId: 'BACKLOG',
    hub_code: 'NYC-001',
    function_code: 'MNT',
    description: 'Critical update for v2 chargers',
    city: 'New York'
  }] : [];

  return (
    <CSVDownloadButton 
      label={label}
      filename={filename || (isTemplate ? 'task_template.csv' : `tasks_export_${new Date().toISOString().split('T')[0]}.csv`)}
      headers={headers}
      sampleRows={sampleRows}
      onPrepareData={!isTemplate ? handleExport : null}
      className="add-task-main-btn"
    />
  );
};

export default TaskCSVDownload;
