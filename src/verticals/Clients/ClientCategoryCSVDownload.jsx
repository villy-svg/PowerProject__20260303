import React from 'react';
import CSVDownloadButton from '../../components/CSVDownloadButton';
import { supabase } from '../../services/core/supabaseClient';

/**
 * ClientCategoryCSVDownload — Thin Wrapper
 * Uses CSVDownloadButton master for all Excel logic.
 */
const ClientCategoryCSVDownload = ({ 
  data = [], 
  label, 
  filename, 
  isTemplate = false, 
  className,
  tableName = 'client_categories',
  entityName = 'Client Categories',
  headers = ['Category Name', 'Code', 'Description']
}) => {
  const defaultLabel = isTemplate ? 'Download Template' : `Export ${entityName}`;
  const finalLabel = label || defaultLabel;

  const handleDownload = async () => {
    if (isTemplate) {
      const templateRow = {};
      headers.forEach(h => {
        if (h.includes('Name')) templateRow[h] = 'Example Name';
        else if (h.includes('Code')) templateRow[h] = 'EXM';
        else if (h.includes('Description')) templateRow[h] = 'Sample description';
        else templateRow[h] = '';
      });
      return [templateRow];
    } else {
      let exportData = data;
      if (!exportData || exportData.length === 0) {
        const { data: fetchedData, error } = await supabase
          .from(tableName)
          .select('*')
          .order('name');
        if (error) {
          console.error('Export fetch error:', error);
          return [];
        }
        exportData = fetchedData;
      }

      return exportData.map(item => {
        const row = {};
        headers.forEach(h => {
          if (h.includes('Name')) row[h] = item.name;
          else if (h.includes('Code') && !h.includes('Default')) row[h] = item.code || '';
          else if (h.includes('Description')) row[h] = item.description || '';
          else if (h.includes('Default Service')) row[h] = item.default_service_code || '';
        });
        return row;
      });
    }
  };

  return (
    <CSVDownloadButton
      label={finalLabel}
      format="xlsx"
      worksheetName={entityName}
      headers={headers}
      filename={filename || (isTemplate ? `${tableName}_template.xlsx` : `${tableName}_export_${new Date().toISOString().split('T')[0]}.xlsx`)}
      onDownload={handleDownload}
      className={className}
    />
  );
};

export default ClientCategoryCSVDownload;
