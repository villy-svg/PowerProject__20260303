import React from 'react';
import CSVDownloadButton from '../../components/CSVDownloadButton';
import { supabase } from '../../services/supabaseClient';

/**
 * EmployeeCSVDownload — Thin Wrapper
 *
 * Uses CSVDownloadButton master for all Excel logic.
 * Defines: headers, data transformation, and dropdown validation data.
 */
const EmployeeCSVDownload = ({ data = [], label, filename, isTemplate = false, className }) => {
  const headers = ['full_name', 'email', 'phone', 'dept_code', 'role_code', 'status', 'hire_date'];

  const defaultLabel = isTemplate ? "Download Employee Template" : "Export Employee Data";
  const finalLabel = label || defaultLabel;

  const handleDownload = async () => {
    const [{ data: depts }, { data: roles }] = await Promise.all([
      supabase.from('departments').select('id, dept_code').order('dept_code'),
      supabase.from('employee_roles').select('id, role_code').order('role_code'),
    ]);
    const deptMap = Object.fromEntries(depts?.map(d => [d.id, d.dept_code]) || []);
    const roleMap = Object.fromEntries(roles?.map(r => [r.id, r.role_code]) || []);

    if (isTemplate) {
      return [{
        full_name: 'John Doe',
        email: 'john.doe@powerpod.com',
        phone: '+1 234 567 890',
        dept_code: Object.values(deptMap)[0] || 'ENG',
        role_code: Object.values(roleMap)[0] || 'SR-DEV',
        status: 'Active',
        hire_date: new Date().toISOString().split('T')[0],
      }];
    } else {
      return data.map(emp => ({
        full_name: emp.full_name,
        email: emp.email,
        phone: emp.phone || '',
        dept_code: deptMap[emp.department_id] || '',
        role_code: roleMap[emp.role_id] || '',
        status: emp.status || 'Active',
        hire_date: emp.hire_date || '',
      }));
    }
  };

  const [validations, setValidations] = React.useState([]);
  React.useEffect(() => {
    if (!isTemplate) return;
    (async () => {
      const [{ data: depts }, { data: roles }] = await Promise.all([
        supabase.from('departments').select('dept_code').order('dept_code'),
        supabase.from('employee_roles').select('role_code').order('role_code'),
      ]);
      setValidations([
        { colLetter: 'D', values: depts?.map(d => d.dept_code).filter(Boolean) || [] },
        { colLetter: 'E', values: roles?.map(r => r.role_code).filter(Boolean) || [] },
        { colLetter: 'F', values: ['Active', 'On Leave', 'Inactive', 'Terminated'] },
      ]);
    })();
  }, [isTemplate]);

  return (
    <CSVDownloadButton
      label={finalLabel}
      format="xlsx"
      worksheetName="Employees"
      headers={headers}
      filename={filename || (isTemplate ? 'employee_template.xlsx' : `employees_export_${new Date().toISOString().split('T')[0]}.xlsx`)}
      onDownload={handleDownload}
      validations={isTemplate ? validations : []}
      style={{}}
      className={className}
    />
  );
};

export default EmployeeCSVDownload;
