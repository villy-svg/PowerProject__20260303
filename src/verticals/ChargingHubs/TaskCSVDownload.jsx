import React from 'react';
import CSVDownloadButton from '../../components/CSVDownloadButton';
import { supabase } from '../../services/core/supabaseClient';

/**
 * TaskCSVDownload — Thin Wrapper
 *
 * Uses CSVDownloadButton master component for all Excel/download logic.
 * This file only defines:
 *   - Column headers
 *   - Data transformation (IDs -> Codes)
 *   - Dropdown validation data (fetched from Supabase)
 *   - Sample row data for templates
 */
const TaskCSVDownload = ({ data = [], label, filename, isTemplate = false, className }) => {
  const headers = ['text', 'priority', 'stage_id', 'task_board', 'hub_code', 'function_code', 'assigned_to', 'description'];

  const defaultLabel = isTemplate ? "Download Task Template" : "Export Tasks";
  const finalLabel = label || defaultLabel;

  const handleDownload = async () => {
    const [{ data: hubs }, { data: functions }, { data: tasksData }] = await Promise.all([
      supabase.from('hubs').select('id, hub_code, name, city').order('hub_code'),
      supabase.from('hub_functions').select('name, function_code').order('function_code'),
      supabase.from('tasks').select('task_board')
    ]);

    const hubCodes = hubs?.map(h => h.hub_code).filter(Boolean) || [];
    const funcCodes = functions?.map(f => f.function_code).filter(Boolean) || [];
    const cityList = [...new Set(hubs?.map(h => h.city).filter(Boolean) || [])].sort();
    
    const allBoards = new Set();
    tasksData?.forEach(t => {
      if (Array.isArray(t.task_board)) {
        t.task_board.forEach(b => allBoards.add(b));
      }
    });
    const boardList = [...allBoards].sort();

    const priorities = ['Low', 'Medium', 'High', 'Urgent'];
    const stages = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'COMPLETED', 'DEPRIORITIZED'];

    if (isTemplate) {
      return [{
        text: 'Sample Task Name',
        priority: priorities[1],
        stage_id: stages[0],
        task_board: boardList.length > 0 ? boardList[0] : 'Hubs',
        hub_code: hubCodes[0] || 'NYC-001',
        function_code: funcCodes[0] || 'MNT',
        assigned_to: '',
        description: 'Sample description',
      }];
    } else {
      const hubMap = Object.fromEntries(hubs?.map(h => [h.id, h.hub_code]) || []);
      const funcMap = Object.fromEntries(functions?.map(f => [f.name, f.function_code]) || []);
      return data.map(task => ({
        text: task.text,
        priority: task.priority || '',
        stage_id: task.stageId || task.stage_id || '',
        task_board: Array.isArray(task.task_board) ? (task.task_board[0] || '') : '',
        hub_code: hubMap[task.hub_id] || task.hub_id || '',
        function_code: funcMap[task.function] || task.function || '',
        assigned_to: task.assigned_to_name || task.assignedToName || task.assigned_to || '',
        description: task.description || '',
      }));
    }
  };

  const handleValidations = async () => {
    const [{ data: hubs }, { data: functions }, { data: tasksData }] = await Promise.all([
      supabase.from('hubs').select('hub_code, city').order('hub_code'),
      supabase.from('hub_functions').select('function_code').order('function_code'),
      supabase.from('tasks').select('task_board')
    ]);
    const hubCodes = hubs?.map(h => h.hub_code).filter(Boolean) || [];
    const funcCodes = functions?.map(f => f.function_code).filter(Boolean) || [];
    const cityList = [...new Set(hubs?.map(h => h.city).filter(Boolean))].sort();
    
    const allBoards = new Set();
    tasksData?.forEach(t => {
      if (Array.isArray(t.task_board)) {
        t.task_board.forEach(b => allBoards.add(b));
      }
    });
    const boardList = [...allBoards].sort();

    return [
      { colLetter: 'B', values: ['Low', 'Medium', 'High', 'Urgent'] },
      { colLetter: 'C', values: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'COMPLETED', 'DEPRIORITIZED'] },
      { colLetter: 'D', values: boardList.length > 0 ? boardList : ['Hubs', 'Hubs Daily'] },
      { colLetter: 'E', values: hubCodes },
      { colLetter: 'F', values: funcCodes },
    ];
  };

  // For templates we need validations; for exports we just need data
  const [validations, setValidations] = React.useState([]);
  React.useEffect(() => {
    if (isTemplate) {
      handleValidations().then(setValidations);
    }
  }, [isTemplate]);

  return (
    <CSVDownloadButton
      label={finalLabel}
      format="xlsx"
      worksheetName="Tasks"
      headers={headers}
      filename={filename || (isTemplate ? 'task_template.xlsx' : `tasks_export_${new Date().toISOString().split('T')[0]}.xlsx`)}
      onDownload={handleDownload}
      validations={isTemplate ? validations : []}
      className={className}
      style={{}}
    />
  );
};

export default TaskCSVDownload;
