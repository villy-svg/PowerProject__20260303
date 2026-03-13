import React from 'react';
import CSVDownloadButton from '../../components/CSVDownloadButton';

const FunctionCSVDownload = ({ className }) => {
  const headers = ['name', 'function_code', 'description'];
  const sampleRows = [
    { name: 'Maintenance', function_code: 'MNT', description: 'Regular upkeep of charging station hardware and site.' },
    { name: 'Cleaning', function_code: 'CLN', description: 'Routine cleaning of the charging bay and station surfaces.' },
    { name: 'Inspection', function_code: 'INSP', description: 'Technician site visit to verify station safety and compliance.' },
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
