import React from 'react';
import CSVDownloadButton from '../../components/CSVDownloadButton';
import { supabase } from '../../services/supabaseClient';

/**
 * ClientCSVDownload — Thin Wrapper
 * Uses CSVDownloadButton master for all Excel logic.
 * Defines: headers, data transformation, and dropdown validation data.
 */
const ClientCSVDownload = ({ data = [], label, filename, isTemplate = false, className }) => {
  const headers = ['Client Name', 'Category', 'Billing Model', 'PoC Name', 'PoC Phone', 'PoC Email', 'Status'];

  const defaultLabel = isTemplate ? 'Download Client Template' : 'Export Client Data';
  const finalLabel = label || defaultLabel;

  const [validations, setValidations] = React.useState([]);

  React.useEffect(() => {
    if (!isTemplate) return;
    (async () => {
      const [{ data: cats }, { data: models }] = await Promise.all([
        supabase.from('client_categories').select('code').order('code'),
        supabase.from('client_billing_models').select('code').order('code'),
      ]);
      setValidations([
        { colLetter: 'B', values: cats?.map(c => c.code).filter(Boolean) || [] },
        { colLetter: 'C', values: models?.map(m => m.code).filter(Boolean) || [] },
        { colLetter: 'G', values: ['Active', 'Inactive'] },
      ]);
    })();
  }, [isTemplate]);

  const handleDownload = async () => {
    const [{ data: cats }, { data: models }] = await Promise.all([
      supabase.from('client_categories').select('id, code').order('code'),
      supabase.from('client_billing_models').select('id, code').order('code'),
    ]);
    const catMap = Object.fromEntries(cats?.map(c => [c.id, c.code]) || []);
    const modelMap = Object.fromEntries(models?.map(m => [m.id, m.code]) || []);

    if (isTemplate) {
      return [{
        'Client Name': 'Tata Motors Ltd.',
        'Category': Object.values(catMap)[0] || 'ENT',
        'Billing Model': Object.values(modelMap)[0] || 'PER-SES',
        'PoC Name': 'Rahul Sharma',
        'PoC Phone': '+919876543210',
        'PoC Email': 'rahul@tatamotors.com',
        'Status': 'Active',
      }];
    } else {
      return data.map(client => ({
        'Client Name': client.name,
        'Category': catMap[client.category_id] || '',
        'Billing Model': modelMap[client.billing_model_id] || '',
        'PoC Name': client.poc_name || '',
        'PoC Phone': client.poc_phone || '',
        'PoC Email': client.poc_email || '',
        'Status': client.status || 'Active',
      }));
    }
  };

  return (
    <CSVDownloadButton
      label={finalLabel}
      format="xlsx"
      worksheetName="Clients"
      headers={headers}
      filename={filename || (isTemplate ? 'client_template.xlsx' : `clients_export_${new Date().toISOString().split('T')[0]}.xlsx`)}
      onDownload={handleDownload}
      validations={isTemplate ? validations : []}
      style={{}}
      className={className}
    />
  );
};

export default ClientCSVDownload;
