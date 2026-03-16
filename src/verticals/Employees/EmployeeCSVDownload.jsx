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
  const headers = ['Full Name', 'Email', 'Phone', 'Gender', 'Date of Birth', 'Primary Hub', 'Department', 'Role', 'Status', 'Date of Joining', 'Account Number', 'IFSC Code', 'Account Name'];

  const defaultLabel = isTemplate ? "Download Employee Template" : "Export Employee Data";
  const finalLabel = label || defaultLabel;

  const handleDownload = async () => {
    const [{ data: depts }, { data: roles }, { data: hubs }] = await Promise.all([
      supabase.from('departments').select('id, dept_code').order('dept_code'),
      supabase.from('employee_roles').select('id, role_code').order('role_code'),
      supabase.from('hubs').select('id, hub_code').order('hub_code'),
    ]);
    const deptMap = Object.fromEntries(depts?.map(d => [d.id, d.dept_code]) || []);
    const roleMap = Object.fromEntries(roles?.map(r => [r.id, r.role_code]) || []);
    const hubMap = Object.fromEntries(hubs?.map(h => [h.id, h.hub_code]) || []);

    if (isTemplate) {
      return [{
        'Full Name': 'John Doe',
        'Email': 'john.doe@powerpod.com',
        'Phone': '+919876543210',
        'Gender': 'Male',
        'Date of Birth': '1990-01-01',
        'Primary Hub': Object.values(hubMap)[0] || 'HUB-01',
        'Department': Object.values(deptMap)[0] || 'ENG',
        'Role': Object.values(roleMap)[0] || 'SR-DEV',
        'Status': 'Active',
        'Date of Joining': new Date().toISOString().split('T')[0],
        'Account Number': '123456789012',
        'IFSC Code': 'SBIN0001234',
        'Account Name': 'John Doe'
      }];
    } else {
      return data.map(emp => ({
        'Full Name': emp.full_name,
        'Email': emp.email,
        'Phone': emp.phone || '',
        'Gender': emp.gender || '',
        'Date of Birth': emp.dob || '',
        'Primary Hub': hubMap[emp.hub_id] || '',
        'Department': deptMap[emp.department_id] || '',
        'Role': roleMap[emp.role_id] || '',
        'Status': emp.status || 'Active',
        'Date of Joining': emp.hire_date || '',
        'Account Number': emp.account_number || '',
        'IFSC Code': emp.ifsc_code || '',
        'Account Name': emp.account_name || ''
      }));
    }
  };

  const [validations, setValidations] = React.useState([]);
  React.useEffect(() => {
    if (!isTemplate) return;
    (async () => {
      const [{ data: depts }, { data: roles }, { data: hubs }] = await Promise.all([
        supabase.from('departments').select('dept_code').order('dept_code'),
        supabase.from('employee_roles').select('role_code').order('role_code'),
        supabase.from('hubs').select('hub_code').order('hub_code'),
      ]);
      setValidations([
        { colLetter: 'D', values: ['Male', 'Female', 'Other', 'Prefer not to say'] },
        { colLetter: 'F', values: hubs?.map(h => h.hub_code).filter(Boolean) || [] },
        { colLetter: 'G', values: depts?.map(d => d.dept_code).filter(Boolean) || [] },
        { colLetter: 'H', values: roles?.map(r => r.role_code).filter(Boolean) || [] },
        { colLetter: 'I', values: ['Active', 'On Leave', 'Inactive', 'Terminated'] },
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
