import React from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/supabaseClient';
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h5 style={{ margin: 0, fontWeight: 600, color: 'var(--brand-green)' }}>
          {conflict.csvRow['Department Name'] || conflict.csvRow.name}
        </h5>
        {conflict.matchMode === 'hard' && (
          <span style={{ fontSize: '0.6rem', padding: '2px 6px', background: 'rgba(255,68,68,0.1)', color: '#ff4444', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 800 }}>
            Code Match
          </span>
        )}
      </div>
      <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0 }}>Code: {conflict.csvRow['Code'] || conflict.csvRow.dept_code || 'None'}</p>
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
        return `${name}|${code}` || 'new-row';
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
