import React from 'react';
import CSVImportButton from '../../components/ui/CSVImportButton';
import { supabase } from '../../services/core/supabaseClient';
import { normalizeValue, calculateSimilarity } from '../../utils/matchingAlgorithms';

/**
 * EmployeeRoleCSVImport — Thin Wrapper
 *
 * Defines role specific import rules.
 */
const EmployeeRoleCSVImport = ({ onImportComplete, className, label = 'Import Roles' }) => {
  const [importing, setImporting] = React.useState(false);
  const [existingRoles, setExistingRoles] = React.useState(null);

  const loadContext = async () => {
    if (existingRoles) return { existingRoles };

    const { data: roles, error } = await supabase
      .from('employee_roles')
      .select('id, name, role_code');

    if (error) throw error;

    setExistingRoles(roles || []);
    return { existingRoles: roles || [] };
  };

  const handleFocus = async () => {
    if (existingRoles) return;
    setImporting(true);
    try { await loadContext(); } catch (err) { console.error(err); } finally { setImporting(false); }
  };

  const isSoftMatch = (row, existing) => {
    const rowName = normalizeValue(row['Role Name'] || row.name || '');
    const extName = normalizeValue(existing.name);
    return calculateSimilarity(rowName, extName) > 0.92;
  };

  const isHardMatch = (row, existing) => {
    const rowCode = (row['Code'] || row.role_code || '').toUpperCase().trim();
    const extCode = (existing.role_code || '').toUpperCase().trim();
    if (rowCode && extCode && rowCode === extCode) return true;
    return false;
  };

  const renderConflictTile = (conflict) => (
    <div className="tile-content">
      <div className="u-flex-between u-mb-4">
        <h5 className="u-m-0 u-fw-600 u-text-brand-green">
          {conflict.csvRow['Role Name'] || conflict.csvRow.name}
        </h5>
        {conflict.matchMode === 'hard' && (
          <span className="csv-error-badge">
            Code Match
          </span>
        )}
      </div>
      <p className="u-text-sm-75 u-opacity-70 u-m-0">Code: {conflict.csvRow['Code'] || conflict.csvRow.role_code || 'None'}</p>
    </div>
  );

  const handleDataParsed = async (rows) => {
    setImporting(true);
    try {
      const ctx = await loadContext();

      const rolesToUpsert = rows
        .filter(row => (row['Role Name'] || row.name || '').trim())
        .map(row => {
          const name = (row['Role Name'] || row.name || '').trim();
          const possibleMatches = ctx.existingRoles.filter(e => isHardMatch(row, e) || isSoftMatch(row, e));
          const existingMatch = possibleMatches.find(e => isHardMatch(row, e)) || possibleMatches[0];

          return {
            id: existingMatch?.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
            name,
            role_code: (row['Code'] || row.role_code || '').toUpperCase().trim() || null,
            seniority_level: parseInt(row['Seniority']) || 1,
            description: row['Description'] || row.description || null,
            updated_at: new Date().toISOString(),
          };
        });

      if (rolesToUpsert.length === 0) throw new Error('No valid role records found.');

      const { error } = await supabase
        .from('employee_roles')
        .upsert(rolesToUpsert, { onConflict: 'id' });

      if (error) throw error;

      alert(`Successfully processed ${rolesToUpsert.length} roles.`);
      setExistingRoles(null);
      if (onImportComplete) onImportComplete();
    } catch (err) {
      console.error('EmployeeRoleCSVImport: Finalize Error:', err);
      alert(`Import failed: ${err.message || String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <CSVImportButton
      label={importing ? 'Importing...' : label}
      onDataParsed={handleDataParsed}
      requiredFields={['Role Name']}
      getConflictKey={(row) => {
        const name = normalizeValue(row['Role Name'] || row.name || '');
        const code = normalizeValue(row['Code'] || row.role_code || '');
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
      existingData={existingRoles}
      renderConflictTile={renderConflictTile}
      entityName="Employee Roles"
      className={className}
      disabled={importing}
      compareFields={[
        { key: 'name', label: 'Role Name' },
        { key: 'role_code', label: 'Code' },
        { key: 'description', label: 'Description' },
        { key: 'seniority_level', label: 'Seniority' },
      ]}
      onFocus={handleFocus}
    />
  );
};

export default EmployeeRoleCSVImport;
