import React from 'react';
import CSVDownloadButton from '../../components/CSVDownloadButton';

const FunctionCSVDownload = ({ className }) => {
  const headers = ['name', 'description'];
  const sampleRows = [
    { name: 'Maintenance', description: 'Regular upkeep of charging station hardware and site.' },
    { name: 'Cleaning', description: 'Routine cleaning of the charging bay and station surfaces.' },
    { name: 'Inspection', description: 'Technician site visit to verify station safety and compliance.' },
  ];

  return (
    <CSVDownloadButton
      filename="hub_functions_template.csv"
      headers={headers}
      sampleRows={sampleRows}
      label="Download CSV Template"
      className={className}
    />
  );
};

export default FunctionCSVDownload;
