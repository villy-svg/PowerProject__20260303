import React from 'react';
import CSVDownloadButton from '../../components/CSVDownloadButton';

const FunctionCSVDownload = ({ className, data, label = "Download CSV Template", filename = "hub_functions_template.csv" }) => {
  const headers = ['name', 'function_code', 'description'];
  const sampleRows = [
    { name: 'Maintenance', function_code: 'MNT', description: 'Regular upkeep of charging station hardware and site.' },
    { name: 'Cleaning', function_code: 'CLN', description: 'Routine cleaning of the charging bay and station surfaces.' },
    { name: 'Inspection', function_code: 'INSP', description: 'Technician site visit to verify station safety and compliance.' },
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

export default FunctionCSVDownload;
