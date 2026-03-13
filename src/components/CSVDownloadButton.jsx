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
  label = 'Download Template',
  className = '',
}) => {
  const handleDownload = () => {
    const rowToCSV = (obj) =>
      headers.map((h) => {
        const val = obj[h] ?? '';
        // Wrap in quotes if value contains comma, quote, or newline
        return /[",\n]/.test(String(val)) ? `"${String(val).replace(/"/g, '""')}"` : val;
      }).join(',');

    const lines = [
      headers.join(','),       // header row
      ...sampleRows.map(rowToCSV) // optional sample rows
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
