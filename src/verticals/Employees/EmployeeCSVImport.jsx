import React, { useState } from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/supabaseClient';
import CSVConflictModal from '../../components/CSVConflictModal';

/**
 * EmployeeCSVImport
 * Handles uploading employee records with conflict detection.
 */
const EmployeeCSVImport = ({ onImportComplete, className }) => {
  const [importing, setImporting] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [pendingData, setPendingData] = useState({ conflicts: [], nonConflictingRows: [], deptMap: {}, roleMap: {} });

  const handleDataParsed = async (rows) => {
    setImporting(true);
    try {
      const [{ data: depts }, { data: roles }, { data: existingEmps }] = await Promise.all([
        supabase.from('departments').select('id, dept_code'),
        supabase.from('employee_roles').select('id, role_code'),
        supabase.from('employees').select('email, full_name')
      ]);

      const deptMap = Object.fromEntries(depts?.map(d => [d.dept_code, d.id]) || []);
      const roleMap = Object.fromEntries(roles?.map(r => [r.role_code, r.id]) || []);

      const conflicts = [];
      const nonConflictingRows = [];

      rows.forEach(row => {
        const existing = existingEmps?.find(e => e.email?.toLowerCase() === row.email?.toLowerCase());
        if (existing) {
          conflicts.push({ csvRow: row, existingRecord: existing });
        } else {
          nonConflictingRows.push(row);
        }
      });

      if (conflicts.length > 0) {
        setPendingData({ conflicts, nonConflictingRows, deptMap, roleMap });
        setShowConflicts(true);
      } else {
        await finalizeImport(rows, deptMap, roleMap);
      }
    } catch (err) {
      console.error("Import Error:", err);
      alert(`Conflict check failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const finalizeImport = async (rows, deptMap, roleMap) => {
    try {
      const empsToInsert = rows.map(row => ({
        full_name: row.full_name,
        email: row.email,
        phone: row.phone || null,
        department_id: deptMap[row.dept_code] || null,
        role_id: roleMap[row.role_code] || null,
        status: row.status || 'Active',
        hire_date: row.hire_date || new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('employees')
        .upsert(empsToInsert, { onConflict: 'email' });

      if (error) throw error;
      alert(`Successfully processed ${empsToInsert.length} employees.`);
      if (onImportComplete) onImportComplete();
    } catch (err) {
      console.error("Finalize Error:", err);
      alert(`Import failed: ${err.message}`);
    }
  };

  const renderConflictTile = (conflict) => (
    <div className="tile-content">
      <h5 style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--brand-green)' }}>{conflict.csvRow.full_name}</h5>
      <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>{conflict.csvRow.email}</p>
    </div>
  );

  return (
    <>
      <CSVImportButton 
        label={importing ? "Importing..." : "Import CSV"}
        onDataParsed={handleDataParsed}
        requiredFields={['full_name', 'email']}
        className={className}
        disabled={importing}
      />
      {showConflicts && (
        <CSVConflictModal 
          entityName="Employees"
          conflicts={pendingData.conflicts}
          onResolve={(selected) => finalizeImport([...pendingData.nonConflictingRows, ...selected], pendingData.deptMap, pendingData.roleMap).then(() => setShowConflicts(false))}
          onCancel={() => setShowConflicts(false)}
          renderConflictTile={renderConflictTile}
        />
      )}
    </>
  );
};

export default EmployeeCSVImport;
