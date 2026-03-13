import React from 'react';

/**
 * Generic CSV Download Button
 * 
 * Props:
 *   filename   {string}   - Output file name e.g. "hubs_template.csv"
 *   headers    {string[]} - Column headers e.g. ['name', 'location', 'status']
 *   sampleRows {object[]} - Optional sample data rows to pre-fill the template
 *   label      {string}   - Button label text
 *   className  {string}   - Extra CSS class names
 */
const CSVDownloadButton = ({
  filename = 'template.csv',
  headers = [],
  sampleRows = [],
  onDownload, // New optional async callback that returns the data array
  label = 'Download Template',
  className = '',
}) => {
  const handleDownload = async () => {
    let exportData = sampleRows;

    // If an onDownload hook is provided, use its result
    if (typeof onDownload === 'function') {
      try {
        const dynamicData = await onDownload();
        if (dynamicData && Array.isArray(dynamicData)) {
          exportData = dynamicData;
        }
      } catch (err) {
        console.error("CSV Data Preparation Error:", err);
        alert("Failed to prepare CSV data.");
        return;
      }
    }

    const rowToCSV = (obj) =>
      headers.map((h) => {
        const val = obj[h] ?? '';
        // Wrap in quotes if value contains comma, quote, or newline
        return /[",\n]/.test(String(val)) ? `"${String(val).replace(/"/g, '""')}"` : val;
      }).join(',');

    const lines = [
      headers.join(','),       // header row
      ...exportData.map(rowToCSV) // data rows
    ];

    const csv = lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Prevent memory leaks
  };

  return (
    <button
      className={`halo-button csv-download-btn ${className}`}
      onClick={handleDownload}
      title={`Download ${filename}`}
    >
      {label}
    </button>
  );
};

export default CSVDownloadButton;
