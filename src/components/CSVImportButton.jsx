import React, { useRef, useState } from 'react';
import Papa from 'papaparse';

/**
 * Generic CSV Import Button
 * 
 * Props:
 *   onDataParsed   {function} - Callback with (validRows, skippedCount)
 *   requiredFields {string[]} - Fields that must exist for a row to be valid
 *   label          {string}   - Button label text
 *   className      {string}   - Extra CSS class names
 */
const CSVImportButton = ({
  onDataParsed,
  requiredFields = [],
  label = 'Import CSV',
  className = '',
}) => {
  const inputRef = useRef(null);
  const [status, setStatus] = useState(null); // null | 'success' | 'error'

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatus(null);

    Papa.parse(file, {
      header: true,           // Use first row as keys
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(), // Normalize keys
      complete: (result) => {
        const rows = result.data;
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
      },
      error: () => setStatus('error'),
    });

    // Reset input so the same file can be re-uploaded if needed
    e.target.value = '';
  };

  return (
    <div className={`csv-import-wrapper ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
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
