import React from 'react';
import CSVDownloadButton from '../../components/CSVDownloadButton';
import { supabase } from '../../services/supabaseClient';

/**
 * DepartmentCSVDownload — Thin Wrapper
 * Uses CSVDownloadButton master for all Excel logic.
 */
const DepartmentCSVDownload = ({ data = [], label, filename, isTemplate = false, className }) => {
  const headers = ['Department Name', 'Code', 'Description'];

  const defaultLabel = isTemplate ? 'Download Template' : 'Export Departments';
  const finalLabel = label || defaultLabel;

  const handleDownload = async () => {
    if (isTemplate) {
      return [{
        'Department Name': 'Engineering',
        'Code': 'ENG',
        'Description': 'Software development and infrastructure',
      }];
    } else {
      let exportData = data;
      if (!exportData || exportData.length === 0) {
        const { data: fetchedData, error } = await supabase
          .from('departments')
          .select('name, dept_code, description')
          .order('name');
        if (error) {
          console.error('Export fetch error:', error);
          return [];
        }
        exportData = fetchedData;
      }

      return exportData.map(dept => ({
        'Department Name': dept.name,
        'Code': dept.dept_code || '',
        'Description': dept.description || '',
      }));
    }
  };

  return (
    <CSVDownloadButton
      label={finalLabel}
      format="xlsx"
      worksheetName="Departments"
      headers={headers}
      filename={filename || (isTemplate ? 'department_template.xlsx' : `departments_export_${new Date().toISOString().split('T')[0]}.xlsx`)}
      onDownload={handleDownload}
      className={className}
    />
  );
};

export default DepartmentCSVDownload;
