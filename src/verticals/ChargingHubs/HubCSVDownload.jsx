import React from 'react';
import CSVDownloadButton from '../../components/CSVDownloadButton';

const HubCSVDownload = ({ className }) => {
  const headers = ['name', 'location', 'status'];
  const sampleRows = [
    { name: 'Downtown Fast Chargers', location: '123 Main St, NY', status: 'active' },
    { name: 'Suburban Hub', location: '456 Oak Ave, NJ', status: 'maintenance' },
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
