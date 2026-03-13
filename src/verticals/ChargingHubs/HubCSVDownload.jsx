import React from 'react';
import CSVDownloadButton from '../../components/CSVDownloadButton';

const HubCSVDownload = ({ className, data, label = "Download CSV Form", filename = "charging_hubs_template.csv" }) => {
  const headers = ['name', 'hub_code', 'city', 'status'];
  const sampleRows = [
    { name: 'Downtown Fast Chargers', hub_code: 'DTN-01', city: '123 Main St, NY', status: 'active' },
    { name: 'Suburban Hub', hub_code: 'SUB-02', city: '456 Oak Ave, NJ', status: 'maintenance' },
  ];

  return (
    <CSVDownloadButton
      filename={filename}
      headers={headers}
      sampleRows={data || sampleRows}
      label={label}
      className={className}
    />
  );
};

export default HubCSVDownload;
