import React from 'react';
import ExcelJS from 'exceljs';

/**
 * CSVDownloadButton — Master Export/Template Downloader
 *
 * Handles both data export and template generation in CSV or XLSX format.
 * Centralizes all ExcelJS boilerplate: workbook setup, header styling, blob download.
 *
 * Props:
 *   filename        {string}     - Output file name override
 *   headers         {string[]}   - Column header keys
 *   sampleRows      {object[]}   - Pre-filled sample data for templates
 *   onDownload      {function}   - Async fn that returns data rows for export
 *   label           {string}     - Button label text
 *   className       {string}     - Extra CSS class names
 *   format          {'csv'|'xlsx'} - Output format (default: 'csv')
 *   worksheetName   {string}     - Excel sheet tab name (default: 'Sheet1')
 *   validations     {object[]}   - Column dropdown definitions for XLSX templates:
 *                                  [{ colLetter, values: string[] }]
 *   validationRows  {number}     - How many rows to apply dropdowns to (default: 100)
 *   style           {object}     - Inline styles for the button
 */
const CSVDownloadButton = ({
  filename,
  headers = [],
  sampleRows = [],
  onDownload,
  label = 'Download',
  className = '',
  format = 'csv',
  worksheetName = 'Sheet1',
  validations = [],
  validationRows = 100,
  style = {},
}) => {
  const handleDownload = async () => {
    // 1. Resolve data rows
    let exportData = sampleRows;
    if (typeof onDownload === 'function') {
      try {
        const dynamicData = await onDownload();
        if (dynamicData && Array.isArray(dynamicData)) {
          exportData = dynamicData;
        }
      } catch (err) {
        console.error('CSV Data Preparation Error:', err);
        alert('Failed to prepare data for download.');
        return;
      }
    }

    if (format === 'xlsx') {
      await downloadXLSX(exportData);
    } else {
      downloadCSV(exportData);
    }
  };

  const downloadCSV = (exportData) => {
    const rowToCSV = (obj) =>
      headers.map((h) => {
        const val = obj[h] ?? '';
        return /[",\n]/.test(String(val))
          ? `"${String(val).replace(/"/g, '""')}"`
          : val;
      }).join(',');

    const lines = [headers.join(','), ...exportData.map(rowToCSV)];
    const csv = lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, filename || 'export.csv');
  };

  const downloadXLSX = async (exportData) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(worksheetName);

    // Define columns
    worksheet.columns = headers.map((h) => ({ header: h, key: h, width: 25 }));

    // Add data rows
    exportData.forEach((row) => worksheet.addRow(row));

    // Header styling
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Column dropdowns / data validation
    if (validations.length > 0) {
      for (let i = 2; i <= validationRows + 1; i++) {
        validations.forEach(({ colLetter, values = [] }) => {
          if (!values.length) return;
          worksheet.getCell(`${colLetter}${i}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`"${values.join(',')}"`],
          };
        });
      }
    }

    // Trigger download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const finalFilename = filename || `${worksheetName.toLowerCase()}_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    triggerDownload(blob, finalFilename);
  };

  const triggerDownload = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      className={`halo-button csv-download-btn ${className}`}
      onClick={handleDownload}
      title={`Download ${filename || label}`}
      style={style}
    >
      {label}
    </button>
  );
};

export default CSVDownloadButton;
