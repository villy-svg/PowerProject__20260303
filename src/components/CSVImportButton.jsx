import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';

/**
 * Generic CSV Import Button
 * 
 * Props:
 *   onDataParsed   {function} - Callback with (validRows, skippedCount)
 *   requiredFields {string[]} - Fields that must exist for a row to be valid
 *   label          {string}   - Button label text
 *   className      {string}   - Extra CSS class names
 *   accept         {string}   - Accepted file extensions (default: .csv,.xlsx)
 */
const CSVImportButton = ({
  onDataParsed,
  requiredFields = [],
  label = 'Import CSV',
  className = '',
  accept = '.csv,.xlsx'
}) => {
  const inputRef = useRef(null);
  const [status, setStatus] = useState(null); // null | 'success' | 'error'

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatus(null);

    const isExcel = file.name.endsWith('.xlsx');

    if (isExcel) {
      // Excel Parsing Logic
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const buffer = evt.target.result;
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(buffer);
          
          const worksheet = workbook.worksheets[0]; // First sheet
          const rows = [];
          
          // Get headers from first row
          const headerRow = worksheet.getRow(1);
          const headers = [];
          headerRow.eachCell((cell, colNumber) => {
            headers[colNumber] = cell.text.trim().toLowerCase();
          });

          // Process data rows
          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header
            const rowData = {};
            row.eachCell((cell, colNumber) => {
              const header = headers[colNumber];
              if (header) {
                rowData[header] = cell.text;
              }
            });
            rows.push(rowData);
          });
          
          processRows(rows);
        } catch (err) {
          console.error("Excel Parsing Error:", err);
          setStatus('error');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV Parsing Logic
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
        complete: (result) => processRows(result.data),
        error: () => setStatus('error'),
      });
    }

    const processRows = (rows) => {
      let skipped = 0;
      const valid = rows.filter((row) => {
        const isValid = requiredFields.every(
          (field) => row[field] && String(row[field]).trim() !== ''
        );
        if (!isValid) skipped++;
        return isValid;
      });

      if (valid.length === 0) {
        setStatus('error');
        return;
      }

      setStatus('success');
      onDataParsed?.(valid, skipped);
    };

    // Reset input so the same file can be re-uploaded if needed
    e.target.value = '';
  };

  return (
    <div className={`csv-import-wrapper ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button
        className={`halo-button csv-import-btn ${status === 'error' ? 'import-error' : status === 'success' ? 'import-success' : ''}`}
        onClick={() => inputRef.current?.click()}
        title="Import a filled CSV file"
      >
        {status === 'error' ? 'Import Failed' : status === 'success' ? 'Imported!' : label}
      </button>
    </div>
  );
};

export default CSVImportButton;
