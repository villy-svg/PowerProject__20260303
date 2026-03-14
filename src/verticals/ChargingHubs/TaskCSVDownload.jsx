import React from 'react';
import ExcelJS from 'exceljs';
import { supabase } from '../../services/supabaseClient';

/**
 * TaskCSVDownload -> Now TaskExcelDownload
 * Specialized Excel exporter for Charging Hubs vertical.
 * Supports .xlsx with dropdown menus (Data Validation) for templates using ExcelJS.
 */
const TaskCSVDownload = ({ data = [], label = 'Export Tasks', filename, isTemplate = false }) => {
  const headers = ['text', 'priority', 'stageId', 'hub_code', 'function_code', 'description', 'city'];

  const handleDownload = async () => {
    // 1. Fetch live data for dropdowns
    const [{ data: hubs }, { data: functions }] = await Promise.all([
      supabase.from('hubs').select('hub_code').order('hub_code'),
      supabase.from('hub_functions').select('function_code').order('function_code')
    ]);

    const hubCodes = hubs?.map(h => h.hub_code).filter(Boolean) || [];
    const funcCodes = functions?.map(f => f.function_code).filter(Boolean) || [];
    const priorities = ['Low', 'Medium', 'High', 'Urgent'];
    const stages = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'COMPLETED', 'DEPRIORITIZED'];

    // 2. Setup Workbook and Sheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tasks');

    // Define columns
    worksheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));

    // 3. Populate Data
    if (isTemplate) {
      worksheet.addRow({
        text: 'Sample Task Name',
        priority: 'Medium',
        stageId: 'BACKLOG',
        hub_code: hubCodes[0] || 'NYC-001',
        function_code: funcCodes[0] || 'MNT',
        description: 'Sample description',
        city: 'Sample City'
      });

      // 4. Add Data Validation (Dropdowns) for 100 rows
      const hubList = `"${hubCodes.join(',')}"`;
      const funcList = `"${funcCodes.join(',')}"`;
      const prioList = `"${priorities.join(',')}"`;
      const stageList = `"${stages.join(',')}"`;

      for (let i = 2; i <= 101; i++) {
        // Priority (Col B)
        worksheet.getCell(`B${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [prioList]
        };
        // Stage (Col C)
        worksheet.getCell(`C${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [stageList]
        };
        // Hub (Col D)
        worksheet.getCell(`D${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [hubList]
        };
        // Function (Col E)
        worksheet.getCell(`E${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [funcList]
        };
      }
    } else {
      // Map existing tasks for export
      const hubMap = Object.fromEntries(hubs?.map(h => [h.id, h.hub_code]) || []);
      const funcMap = Object.fromEntries(functions?.map(f => [f.name, f.function_code]) || []);
      
      data.forEach(task => {
        worksheet.addRow({
          text: task.text,
          priority: task.priority || '',
          stageId: task.stageId,
          hub_code: hubMap[task.hub_id] || task.hub_id || '',
          function_code: funcMap[task.function] || task.function || '',
          description: task.description || '',
          city: task.city || ''
        });
      });
    }

    // Styling Header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // 5. Trigger Download
    const finalFilename = filename || (isTemplate ? 'task_template.xlsx' : `tasks_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = finalFilename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <button 
      className="halo-button csv-download-btn add-task-main-btn" 
      onClick={handleDownload}
      title={isTemplate ? "Download Excel Template with Dropdowns" : "Export Tasks to Excel"}
    >
      {label}
    </button>
  );
};

export default TaskCSVDownload;
