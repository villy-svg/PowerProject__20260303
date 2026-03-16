import React from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/supabaseClient';
import { normalizeValue } from '../../utils/matchingAlgorithms';

/**
 * EmployeeCSVImport — Thin Wrapper
 *
 * Defines employee-specific import rules:
 *   - Conflict key: email address (case-insensitive)
 *   - Resolves dept/role codes to IDs before upsert
 *
 * All duplicate detection (in-file + DB) is handled by CSVImportButton.
 */
const EmployeeCSVImport = ({ onImportComplete, className, label = 'Import CSV' }) => {
  const [importing, setImporting] = React.useState(false);
  const [existingEmps, setExistingEmps] = React.useState(null);
  const [lookupMaps, setLookupMaps] = React.useState(null);

  const loadContext = async () => {
    if (existingEmps) return { existingEmps, ...lookupMaps };
    const [{ data: depts }, { data: roles }, { data: emps }] = await Promise.all([
      supabase.from('departments').select('id, dept_code'),
      supabase.from('employee_roles').select('id, role_code'),
      supabase.from('employees').select('id, email, full_name, phone'),
    ]);
    const deptMap = Object.fromEntries(depts?.map(d => [d.dept_code, d.id]) || []);
    const roleMap = Object.fromEntries(roles?.map(r => [r.role_code, r.id]) || []);
    const maps = { deptMap, roleMap };
    setExistingEmps(emps || []);
    setLookupMaps(maps);
    return { existingEmps: emps || [], ...maps };
  };

  // Pre-load on first interaction
  const handleFocus = async () => {
    if (existingEmps) return;
    setImporting(true);
    try { 
      await loadContext(); 
    } catch (err) { 
      console.error(err); 
    } finally {
      setImporting(false);
    }
  };

  // Uniqueness: Name + Phone (normalized)
  const getConflictKey = (row) => {
    const name = normalizeValue(row.full_name || row.name || '');
    const phone = normalizeValue(row.phone || row.contactNumber || '');
    return `${name}|${phone}`;
  };

  const renderConflictTile = (conflict) => (
    <div className="tile-content">
      <h5 style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--brand-green)' }}>
        {conflict.csvRow.full_name || conflict.csvRow.name}
      </h5>
      <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0 }}>
        {conflict.csvRow.email}
      </p>
      <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0 }}>
        {conflict.csvRow.phone || conflict.csvRow.contactNumber || 'No Phone'}
      </p>
    </div>
  );

  const handleDataParsed = async (rows) => {
    setImporting(true);
    try {
      const ctx = await loadContext();

      const parseDateForDB = (rawDate) => {
        if (!rawDate) return new Date().toISOString().split('T')[0];
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.valueOf())) {
          // Extract local YYYY-MM-DD to avoid GMT offset string issues in Postgres
          const year = parsed.getFullYear();
          const month = String(parsed.getMonth() + 1).padStart(2, '0');
          const day = String(parsed.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        return new Date().toISOString().split('T')[0];
      };

      const empsToInsert = rows.map(row => {
        const name = row.full_name || row.name || '';
        if (!name.trim()) {
          console.warn('Skipping employee row with missing name:', row);
          return null;
        }

        // Find if this row matches an existing record by our conflict key
        const existingMatch = ctx.existingEmps.find(e => getConflictKey(e) === getConflictKey(row));
        
        return {
          id: existingMatch?.id || crypto.randomUUID(),
          full_name: name.trim(),
          email: row.email,
          phone: row.phone || null,
          department_id: ctx.deptMap[row.dept_code || row.department] || null,
          role_id: ctx.roleMap[row.role_code || row.role] || null,
          status: row.status || 'Active',
          hire_date: parseDateForDB(row.hire_date),
          updated_at: new Date().toISOString(),
        };
      }).filter(Boolean);

      if (empsToInsert.length === 0) {
        throw new Error('No valid employee records found (all missing names).');
      }

      const { error } = await supabase
        .from('employees')
        .upsert(empsToInsert, { onConflict: 'id' });

      if (error) throw error;
      alert(`Successfully processed ${empsToInsert.length} employees.`);
      setExistingEmps(null); // Reset for next import
      if (onImportComplete) onImportComplete();
    } catch (err) {
      console.error('Finalize Error:', err);
      alert(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <CSVImportButton
      label={importing ? 'Importing...' : label}
      onDataParsed={handleDataParsed}
      requiredFields={['full_name', 'email']}
      getConflictKey={getConflictKey}
      existingData={existingEmps}
      renderConflictTile={renderConflictTile}
      entityName="Employees"
      className={className}
      disabled={importing}
      compareFields={[
        { key: 'full_name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'dept_code', label: 'Dept Code' },
        { key: 'role_code', label: 'Role Code' },
        { key: 'hire_date', label: 'D.O.J' }
      ]}
      onFocus={handleFocus}
    />
  );
};

export default EmployeeCSVImport;
