import React from 'react';
import CSVDownloadButton from '../../components/CSVDownloadButton';
import { supabase } from '../../services/core/supabaseClient';

/**
 * EmployeeRoleCSVDownload — Thin Wrapper
 * Uses CSVDownloadButton master for all Excel logic.
 */
const EmployeeRoleCSVDownload = ({ data = [], label, filename, isTemplate = false, className }) => {
  const headers = ['Role Name', 'Code', 'Seniority', 'Description'];

  const defaultLabel = isTemplate ? 'Download Template' : 'Export Roles';
  const finalLabel = label || defaultLabel;

  const handleDownload = async () => {
    if (isTemplate) {
      return [{
        'Role Name': 'Senior Developer',
        'Code': 'SR-DEV',
        'Seniority': 8,
        'Description': 'Technical leadership and complex coding',
      }];
    } else {
      let exportData = data;
      if (!exportData || exportData.length === 0) {
        const { data: fetchedData, error } = await supabase
          .from('employee_roles')
          .select('name, role_code, seniority_level, description')
          .order('name');
        if (error) {
          console.error('Export fetch error:', error);
          return [];
        }
        exportData = fetchedData;
      }

      return exportData.map(role => ({
        'Role Name': role.name,
        'Code': role.role_code || '',
        'Seniority': role.seniority_level || 1,
        'Description': role.description || '',
      }));
    }
  };

  return (
    <CSVDownloadButton
      label={finalLabel}
      format="xlsx"
      worksheetName="Employee Roles"
      headers={headers}
      filename={filename || (isTemplate ? 'role_template.xlsx' : `roles_export_${new Date().toISOString().split('T')[0]}.xlsx`)}
      onDownload={handleDownload}
      className={className}
    />
  );
};

export default EmployeeRoleCSVDownload;
