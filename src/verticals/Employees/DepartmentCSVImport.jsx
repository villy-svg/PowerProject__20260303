import React from 'react';
import CSVImportButton from '../../components/ui/CSVImportButton';
import { supabase } from '../../services/core/supabaseClient';
import { normalizeValue, calculateSimilarity } from '../../utils/matchingAlgorithms';

/**
 * DepartmentCSVImport — Thin Wrapper
 *
 * Defines department specific import rules.
 */
const DepartmentCSVImport = ({ onImportComplete, className, label = 'Import Departments' }) => {
  const [importing, setImporting] = React.useState(false);
  const [existingDepartments, setExistingDepartments] = React.useState(null);

  const loadContext = async () => {
    if (existingDepartments) return { existingDepartments };

    const { data: departments, error } = await supabase
      .from('departments')
      .select('id, name, dept_code');

    if (error) throw error;

    setExistingDepartments(departments || []);
    return { existingDepartments: departments || [] };
  };

  const handleFocus = async () => {
    if (existingDepartments) return;
    setImporting(true);
    try { await loadContext(); } catch (err) { console.error(err); } finally { setImporting(false); }
  };

  const isSoftMatch = (row, existing) => {
    const rowName = normalizeValue(row['Department Name'] || row.name || '');
    const extName = normalizeValue(existing.name);
    return calculateSimilarity(rowName, extName) > 0.92;
  };

  const isHardMatch = (row, existing) => {
    const rowCode = (row['Code'] || row.dept_code || '').toUpperCase().trim();
    const extCode = (existing.dept_code || '').toUpperCase().trim();
    if (rowCode && extCode && rowCode === extCode) return true;
    return false;
  };

  const renderConflictTile = (conflict) => (
    <div className="tile-content">
      <div className="u-flex-between u-mb-4">
        <h5 className="u-m-0 u-fw-600 u-text-brand-green">
          {conflict.csvRow['Department Name'] || conflict.csvRow.name}
        </h5>
        {conflict.matchMode === 'hard' && (
          <span className="csv-error-badge">
            Code Match
          </span>
        )}
      </div>
      <p className="u-text-sm-75 u-opacity-70 u-m-0">Code: {conflict.csvRow['Code'] || conflict.csvRow.dept_code || 'None'}</p>
    </div>
  );

  const handleDataParsed = async (rows) => {
    setImporting(true);
    try {
      const ctx = await loadContext();

      const deptsToUpsert = rows
        .filter(row => (row['Department Name'] || row.name || '').trim())
        .map(row => {
          const name = (row['Department Name'] || row.name || '').trim();
          const possibleMatches = ctx.existingDepartments.filter(e => isHardMatch(row, e) || isSoftMatch(row, e));
          const existingMatch = possibleMatches.find(e => isHardMatch(row, e)) || possibleMatches[0];

          return {
            id: existingMatch?.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
            name,
            dept_code: (row['Code'] || row.dept_code || '').toUpperCase().trim() || null,
            description: row['Description'] || row.description || null,
            updated_at: new Date().toISOString(),
          };
        });

      if (deptsToUpsert.length === 0) throw new Error('No valid department records found.');

      const { error } = await supabase
        .from('departments')
        .upsert(deptsToUpsert, { onConflict: 'id' });

      if (error) throw error;

      alert(`Successfully processed ${deptsToUpsert.length} departments.`);
      setExistingDepartments(null);
      if (onImportComplete) onImportComplete();
    } catch (err) {
      console.error('DepartmentCSVImport: Finalize Error:', err);
      alert(`Import failed: ${err.message || String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <CSVImportButton
      label={importing ? 'Importing...' : label}
      onDataParsed={handleDataParsed}
      requiredFields={['Department Name']}
      getConflictKey={(row) => {
        const name = normalizeValue(row['Department Name'] || row.name || '');
        const code = normalizeValue(row['Code'] || row.dept_code || '');
        const key = `${name}|${code}`;
        return key === '|' ? 'new-row' : key;
      }}
      findConflict={(row, existingData) => {
        const hard = existingData.find(e => isHardMatch(row, e));
        if (hard) return { existingRecord: hard, matchMode: 'hard' };
        const soft = existingData.find(e => isSoftMatch(row, e));
        if (soft) return { existingRecord: soft, matchMode: 'soft' };
        return null;
      }}
      existingData={existingDepartments}
      renderConflictTile={renderConflictTile}
      entityName="Departments"
      className={className}
      disabled={importing}
      compareFields={[
        { key: 'name', label: 'Department Name' },
        { key: 'dept_code', label: 'Code' },
        { key: 'description', label: 'Description' },
      ]}
      onFocus={handleFocus}
    />
  );
};

export default DepartmentCSVImport;
