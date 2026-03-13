import React from 'react';
import CSVDownloadButton from '../../components/CSVDownloadButton';

const HubCSVDownload = ({ className }) => {
  const headers = ['name', 'hub_code', 'city', 'status'];
  const sampleRows = [
    { name: 'Downtown Fast Chargers', hub_code: 'DTN-01', city: '123 Main St, NY', status: 'active' },
    { name: 'Suburban Hub', hub_code: 'SUB-02', city: '456 Oak Ave, NJ', status: 'maintenance' },
  ];

  return (
    <CSVDownloadButton
      filename="charging_hubs_template.csv"
      headers={headers}
      sampleRows={sampleRows}
      label="Download CSV Form"
      className={className}
    />
  );
};

export default HubCSVDownload;
