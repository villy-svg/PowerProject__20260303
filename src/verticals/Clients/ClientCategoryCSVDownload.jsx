import React from 'react';
import CSVDownloadButton from '../../components/CSVDownloadButton';
import { supabase } from '../../services/supabaseClient';

/**
 * ClientCategoryCSVDownload — Thin Wrapper
 * Uses CSVDownloadButton master for all Excel logic.
 */
const ClientCategoryCSVDownload = ({ data = [], label, filename, isTemplate = false, className }) => {
  const headers = ['Category Name', 'Code', 'Description'];

  const defaultLabel = isTemplate ? 'Download Template' : 'Export Categories';
  const finalLabel = label || defaultLabel;

  const handleDownload = async () => {
    if (isTemplate) {
      return [{
        'Category Name': 'Enterprise',
        'Code': 'ENT',
        'Description': 'Large scale corporate clients',
      }];
    } else {
      // If data is provided, use it, otherwise fetch from DB
      let exportData = data;
      if (!exportData || exportData.length === 0) {
        const { data: fetchedData, error } = await supabase
          .from('client_categories')
          .select('name, code, description')
          .order('name');
        if (error) {
          console.error('Export fetch error:', error);
          return [];
        }
        exportData = fetchedData;
      }

      return exportData.map(cat => ({
        'Category Name': cat.name,
        'Code': cat.code || '',
        'Description': cat.description || '',
      }));
    }
  };

  return (
    <CSVDownloadButton
      label={finalLabel}
      format="xlsx"
      worksheetName="Client Categories"
      headers={headers}
      filename={filename || (isTemplate ? 'client_category_template.xlsx' : `client_categories_export_${new Date().toISOString().split('T')[0]}.xlsx`)}
      onDownload={handleDownload}
      className={className}
    />
  );
};

export default ClientCategoryCSVDownload;
