import React from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/supabaseClient';
import { normalizeValue } from '../../utils/matchingAlgorithms';
import { generateEmpCode, calculateBadgeId, logEmployeeHistory } from '../../utils/employeeUtils';

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
    const [{ data: depts }, { data: roles }, { data: hubs }, { data: emps }] = await Promise.all([
      supabase.from('departments').select('id, name, dept_code'),
      supabase.from('employee_roles').select('id, name, role_code'),
      supabase.from('hubs').select('id, name, hub_code'),
      supabase.from('employees').select('id, email, full_name, phone'),
    ]);

    // Robust Mapping: Support both Names and Codes
    const createMap = (items, codeKey) => {
      const m = {};
      items?.forEach(item => {
        if (item.id) {
          const nameKey = item.name?.toLowerCase().trim();
          const codeK = item[codeKey]?.toLowerCase().trim();
          if (nameKey) m[nameKey] = item.id;
          if (codeK) m[codeK] = item.id;
        }
      });
      return m;
    };

    const maps = {
      deptMap: createMap(depts, 'dept_code'),
      roleMap: createMap(roles, 'role_code'),
      hubMap: createMap(hubs, 'hub_code')
    };

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


      const empsToInsert = await Promise.all(rows.map(async (row, idx) => {
        const name = row.full_name || row.name || '';
        if (!name.trim()) return null;

        // Find if this row matches an existing record by our conflict key
        const existingMatch = ctx.existingEmps.find(e => getConflictKey(e) === getConflictKey(row));
        
        // Robust Lookup: Clean and normalize input
        const lookup = (val, map) => {
          if (!val) return null;
          return map[val.toString().toLowerCase().trim()] || null;
        };

        const role_id = lookup(row.role_code || row.role, ctx.roleMap);
        const department_id = lookup(row.dept_code || row.department, ctx.deptMap);
        const hire_date = parseDateForDB(row.hire_date);

        // ID & Badge Logic
        let emp_code = existingMatch?.emp_code;
        let badge_id = existingMatch?.badge_id;

        if (!emp_code) {
          emp_code = generateEmpCode();
        }

        // Re-calculate badge if new or role/dept changed
        if (!badge_id || (existingMatch && (existingMatch.role_id !== role_id || existingMatch.department_id !== department_id))) {
          badge_id = await calculateBadgeId({ role_id, department_id }, hire_date);
        }

        const mapped = {
          id: existingMatch?.id || crypto.randomUUID(),
          full_name: name.trim(),
          email: row.email || null,
          phone: row.phone || null,
          gender: row.gender || null,
          dob: parseDateForDB(row.dob),
          department_id,
          role_id,
          hub_id: lookup(row.hub_code || row.hub, ctx.hubMap),
          status: row.status || 'Active',
          hire_date,
          account_number: row.account_number || null,
          ifsc_code: row.ifsc_code || null,
          account_name: row.account_name || null,
          pan_number: row.pan_number || row.pan || null,
          emp_code,
          badge_id,
          updated_at: new Date().toISOString(),
        };

        return mapped;
      })).then(results => results.filter(Boolean));

      if (empsToInsert.length === 0) {
        throw new Error('No valid employee records found.');
      }

      const { error } = await supabase
        .from('employees')
        .upsert(empsToInsert, { onConflict: 'id' });

      if (error) throw error;

      // History Logging (Batch)
      for (const emp of empsToInsert) {
        await logEmployeeHistory(emp.id, emp, 'CSV_IMPORT');
      }

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
        { key: 'gender', label: 'Gender' },
        { key: 'dob', label: 'D.O.B' },
        { key: 'hub_code', label: 'Hub' },
        { key: 'dept_code', label: 'Dept' },
        { key: 'role_code', label: 'Role' },
        { key: 'hire_date', label: 'D.O.J' }
      ]}
      onFocus={handleFocus}
    />
  );
};

export default EmployeeCSVImport;
