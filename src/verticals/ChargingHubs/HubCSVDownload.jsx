import React from 'react';
import CSVDownloadButton from '../../components/CSVDownloadButton';

const HubCSVDownload = ({ className, data, label, filename }) => {
  const headers = ['name', 'hub_code', 'city', 'status'];

  const isTemplate = !data;
  const defaultLabel = isTemplate ? "Download Hubs Template" : "Export Hubs Data";
  const finalLabel = label || defaultLabel;

  const sampleRows = [
    { name: 'Downtown Fast Chargers', hub_code: 'DTN-01', city: '123 Main St, NY', status: 'active' },
    { name: 'Suburban Hub', hub_code: 'SUB-02', city: '456 Oak Ave, NJ', status: 'maintenance' },
  ];

  return (
    <CSVDownloadButton
      filename={filename || (isTemplate ? 'hubs_template.xlsx' : 'hubs_export.xlsx')}
      headers={headers}
      sampleRows={data || sampleRows}
      label={finalLabel}
      format="xlsx"
      className={className}
    />
  );
};

export default HubCSVDownload;
