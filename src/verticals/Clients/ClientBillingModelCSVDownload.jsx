import React from 'react';
import CSVDownloadButton from '../../components/CSVDownloadButton';
import { supabase } from '../../services/core/supabaseClient';

/**
 * ClientBillingModelCSVDownload — Thin Wrapper
 * Uses CSVDownloadButton master for all Excel logic.
 */
const ClientBillingModelCSVDownload = ({ data = [], label, filename, isTemplate = false, className }) => {
  const headers = ['Model Name', 'Code', 'Description'];

  const defaultLabel = isTemplate ? 'Download Template' : 'Export Billing Models';
  const finalLabel = label || defaultLabel;

  const handleDownload = async () => {
    if (isTemplate) {
      return [{
        'Model Name': 'Monthly Retainer',
        'Code': 'MNT-RET',
        'Description': 'Fixed monthly fee for all services',
      }];
    } else {
      let exportData = data;
      if (!exportData || exportData.length === 0) {
        const { data: fetchedData, error } = await supabase
          .from('client_billing_models')
          .select('name, code, description')
          .order('name');
        if (error) {
          console.error('Export fetch error:', error);
          return [];
        }
        exportData = fetchedData;
      }

      return exportData.map(model => ({
        'Model Name': model.name,
        'Code': model.code || '',
        'Description': model.description || '',
      }));
    }
  };

  return (
    <CSVDownloadButton
      label={finalLabel}
      format="xlsx"
      worksheetName="Billing Models"
      headers={headers}
      filename={filename || (isTemplate ? 'billing_model_template.xlsx' : `billing_models_export_${new Date().toISOString().split('T')[0]}.xlsx`)}
      onDownload={handleDownload}
      className={className}
    />
  );
};

export default ClientBillingModelCSVDownload;
