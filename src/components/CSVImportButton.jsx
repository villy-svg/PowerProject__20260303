import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import CSVConflictModal from './ConflictModal';
import './CSVImportButton.css';

/**
 * CSVImportButton — Master Import Orchestrator
 *
 * Handles the full import lifecycle:
 *   1. File parsing (CSV or XLSX)
 *   2. Required field validation
 *   3. In-file duplicate detection (via getConflictKey)
 *   4. Database conflict detection (via existingData + getConflictKey)
 *   5. Conflict resolution modal (CSVConflictModal)
 *   6. Calls onDataParsed with the final clean, resolved set of rows
 *
 * Props:
 *   onDataParsed      {function}  - Called with (resolvedRows, stats) after all conflicts are resolved
 *   requiredFields    {string[]}  - Fields that must be non-empty for a row to be valid
 *   getConflictKey    {function}  - (row) => string. Defines row uniqueness for dedup
 *   existingData      {object[]}  - Current DB records for conflict comparison
 *   renderConflictTile {function} - (conflict, isSelected) => JSX for modal tiles
 *   entityName        {string}    - Used in modal labels (e.g. "Tasks", "Employees")
 *   label             {string}    - Button label text
 *   className         {string}    - Extra CSS class names
 *   accept            {string}    - Accepted file extensions (default: .csv,.xlsx)
 *   disabled          {boolean}   - Disables the button
 */
const CSVImportButton = ({
  onDataParsed,
  requiredFields = [],
  getConflictKey = null,
  existingData = null,
  renderConflictTile = null,
  entityName = 'Entries',
  label = 'Import CSV',
  className = '',
  accept = '.csv,.xlsx',
  disabled = false,
  onFocus = null,
  compareFields = [],
  findConflict = null // (row, existingData) => { csvRow, existingRecord, matchMode } | null
}) => {
  const inputRef = useRef(null);
  const [status, setStatus] = useState(null); // null | 'success' | 'error'
  const [showConflicts, setShowConflicts] = useState(false);
  const [pendingConflicts, setPendingConflicts] = useState({ conflicts: [], nonConflictingRows: [] });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus(null);

    const isExcel = file.name.endsWith('.xlsx');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const buffer = evt.target.result;
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(buffer);
          const worksheet = workbook.worksheets[0];
          const rows = [];
          const headerRow = worksheet.getRow(1);
          const headers = [];
          headerRow.eachCell((cell, colNumber) => {
            headers[colNumber] = cell.text.trim().toLowerCase();
          });
          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const rowData = {};
            row.eachCell((cell, colNumber) => {
              const header = headers[colNumber];
              if (header) rowData[header] = cell.text;
            });
            rows.push(rowData);
          });
          processRows(rows);
        } catch (err) {
          console.error('Excel Parsing Error:', err);
          setStatus('error');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
        complete: (result) => processRows(result.data),
        error: () => setStatus('error'),
      });
    }

    // Reset so the same file can be re-uploaded
    e.target.value = '';
  };

  const normalizeHeaders = (data) => {
    if (!data || data.length === 0) return data;
    
    // Default system-wide mapping (can be extended via props)
    const defaultMap = {
      full_name: ['full_name', 'name', 'full name', 'employee name', 'staff name', 'fullname', 'emp name'],
      email: ['email', 'email address', 'emailid', 'email_id', 'mail'],
      phone: ['phone', 'contact', 'mobile', 'phone number', 'contact number', 'contactnumber', 'phone_number'],
      dept_code: ['department', 'dept', 'city', 'location', 'unit', 'department_code', 'department_name'],
      role_code: ['role', 'designation', 'position', 'role_code', 'job title', 'role_id', 'role_name'],
      hire_date: ['hire_date', 'doj', 'joining date', 'hire date', 'joining_date', 'date of joining', 'dateofjoining'],
      status: ['status', 'active', 'state'],
      gender: ['gender', 'sex', 'male/female'],
      dob: ['dob', 'date of birth', 'birth date', 'birthdate'],
      hub_code: ['hub_code', 'primary hub', 'hub', 'location code', 'station'],
      account_number: ['account_number', 'account number', 'bank account', 'acc num'],
      ifsc_code: ['ifsc_code', 'ifsc code', 'ifsc'],
      account_name: ['account_name', 'account name', 'bank name', 'beneficiary'],
      pan_number: ['pan_number', 'pan number', 'pan', 'pan no', 'pan card'],
      // Client-specific mappings
      client_name: ['client_name', 'client name', 'name', 'client', 'company name'],
      category: ['category', 'client category', 'client_category', 'type'],
      billing_model: ['billing_model', 'billing model', 'billing_model_id', 'billing'],
      poc_name: ['poc_name', 'poc name', 'point of contact', 'contact person', 'poc'],
      poc_phone: ['poc_phone', 'poc phone', 'phone', 'contact number', 'mobile'],
      poc_email: ['poc_email', 'poc email', 'email', 'email address'],
      category_name: ['category_name', 'category name', 'client category name', 'name'],
      model_name: ['model_name', 'model name', 'billing model name', 'name'],
      code: ['code', 'identifier', 'short name'],
      description: ['description', 'details', 'notes', 'about']
    };

    return data.map(row => {
      const normalized = {};
      Object.keys(row).forEach(key => {
        const lowerKey = key.toLowerCase().trim().replace(/_/g, '').replace(/\s/g, '');
        const canonicalKey = Object.keys(defaultMap).find(ck => 
          defaultMap[ck].some(alias => {
            const normAlias = alias.toLowerCase().replace(/_/g, '').replace(/\s/g, '');
            return normAlias === lowerKey;
          })
        );
        if (canonicalKey) {
          normalized[canonicalKey] = row[key];
        } else {
          normalized[key] = row[key];
        }
      });
      return normalized;
    });
  };

  const processRows = (rawRows) => {
    // 0. Robust Header Normalization
    const rows = normalizeHeaders(rawRows);

    // 1. Required field validation
    let skipped = 0;
    const valid = rows.filter((row) => {
      const isValid = requiredFields.every(
        (field) => row[field] && String(row[field]).trim() !== ''
      );
      if (!isValid) skipped++;
      return isValid;
    });

    if (valid.length === 0) {
      console.warn('All rows failed required field check:', requiredFields);
      setStatus('error');
      return;
    }

    // 2. In-file deduplication (last occurrence wins)
    let inFileDups = 0;
    let dedupedRows = valid;
    if (getConflictKey) {
      const seen = new Map();
      valid.forEach(row => seen.set(getConflictKey(row), row));
      dedupedRows = Array.from(seen.values());
      inFileDups = valid.length - dedupedRows.length;
    }

    // 3. Database conflict detection
    if (existingData && (findConflict || getConflictKey)) {
      const conflicts = [];
      const nonConflictingRows = [];

      if (findConflict) {
        dedupedRows.forEach(row => {
          const conflict = findConflict(row, existingData);
          if (conflict) {
            conflicts.push({ ...conflict, csvRow: row }); // Ensure csvRow is attached
          } else {
            nonConflictingRows.push(row);
          }
        });
      } else {
        const existingMap = new Map(existingData.map(r => [getConflictKey(r), r]));
        dedupedRows.forEach(row => {
          const existingRecord = existingMap.get(getConflictKey(row));
          if (existingRecord) {
            conflicts.push({ csvRow: row, existingRecord });
          } else {
            nonConflictingRows.push(row);
          }
        });
      }

      if (conflicts.length > 0) {
        setPendingConflicts({ conflicts, nonConflictingRows });
        setShowConflicts(true);
        setStatus('success');
        return;
      }
      onDataParsed(nonConflictingRows);
    } else {
      onDataParsed(dedupedRows);
    }
  };

  const handleResolveConflicts = (selectedRowsToUpdate) => {
    setShowConflicts(false);
    // CRITICAL: Extract the actual row data (csvRow) from the conflict objects
    const resolvedData = selectedRowsToUpdate.map(c => c.csvRow);
    const finalRows = [...pendingConflicts.nonConflictingRows, ...resolvedData];
    finalize(finalRows, { skipped: 0, inFileDups: 0 });
  };

  const handleKeepBoth = (conflictToKeep) => {
    // Remove it from the current conflicts array
    const updatedConflicts = pendingConflicts.conflicts.filter(c => c !== conflictToKeep);
    
    // Add it to the non-conflicting array (it will be inserted as a new row)
    const updatedNonConflicting = [...pendingConflicts.nonConflictingRows, conflictToKeep.csvRow];
    
    setPendingConflicts({ conflicts: updatedConflicts, nonConflictingRows: updatedNonConflicting });
    
    // If we've resolved all conflicts this way, finalize automatically
    if (updatedConflicts.length === 0) {
      setShowConflicts(false);
      finalize(updatedNonConflicting, { skipped: 0, inFileDups: 0 });
    }
  };

  const handleCancelConflicts = () => {
    setShowConflicts(false);
    setStatus(null);
  };

  const finalize = (rows, stats) => {
    if (rows.length === 0) {
      setStatus('error');
      return;
    }
    setStatus('success');
    onDataParsed?.(rows, stats);
  };

  return (
    <>
      <div className="csv-import-wrapper">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={handleFileChange}
          disabled={disabled}
        />
        <button
          className={`halo-button csv-import-btn ${className} ${status === 'error' ? 'import-error' : status === 'success' ? 'import-success' : ''}`}
          onClick={() => inputRef.current?.click()}
          onFocus={onFocus}
          onMouseEnter={onFocus} // Also trigger on hover for faster loading
          title="Import a filled CSV or Excel file"
          disabled={disabled}
        >
          {status === 'error' ? 'Import Failed' : status === 'success' ? 'Imported!' : label}
        </button>
      </div>

      {showConflicts && renderConflictTile && (
        <CSVConflictModal
          isOpen={showConflicts}
          onClose={handleCancelConflicts}
          entityName={entityName}
          conflicts={pendingConflicts.conflicts}
          onResolve={handleResolveConflicts}
          onKeepBoth={handleKeepBoth}
          renderConflictTile={(c) => renderConflictTile(c)}
          compareFields={compareFields}
        />
      )}
    </>
  );
};

export default CSVImportButton;
