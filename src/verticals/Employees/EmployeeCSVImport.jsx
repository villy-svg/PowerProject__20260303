import React from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/supabaseClient';

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
      supabase.from('employees').select('email, full_name'),
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
    try { await loadContext(); } catch (err) { console.error(err); }
  };

  // Uniqueness: email (case-insensitive)
  const getConflictKey = (row) => (row.email || '').toLowerCase().trim();

  const renderConflictTile = (conflict) => (
    <div className="tile-content">
      <h5 style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--brand-green)' }}>
        {conflict.csvRow.full_name}
      </h5>
      <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>{conflict.csvRow.email}</p>
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

      const empsToInsert = rows.map(row => ({
        full_name: row.full_name,
        email: row.email,
        phone: row.phone || null,
        department_id: ctx.deptMap[row.dept_code] || null,
        role_id: ctx.roleMap[row.role_code] || null,
        status: row.status || 'Active',
        hire_date: parseDateForDB(row.hire_date),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('employees')
        .upsert(empsToInsert, { onConflict: 'email' });

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
      onFocus={handleFocus}
    />
  );
};

export default EmployeeCSVImport;
