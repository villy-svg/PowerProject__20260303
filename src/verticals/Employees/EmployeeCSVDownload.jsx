import React from 'react';
import ExcelJS from 'exceljs';
import { supabase } from '../../services/supabaseClient';

/**
 * EmployeeCSVDownload
 * Specialized Excel exporter for Employee Records.
 * Supports .xlsx with dropdown menus for Department and Role.
 */
const EmployeeCSVDownload = ({ data = [], label = 'Export Employees', filename, isTemplate = false }) => {
  const headers = ['full_name', 'email', 'phone', 'dept_code', 'role_code', 'status', 'hire_date'];

  const handleDownload = async () => {
    // 1. Fetch live data for dropdowns
    const [{ data: depts }, { data: roles }] = await Promise.all([
      supabase.from('departments').select('dept_code').order('dept_code'),
      supabase.from('employee_roles').select('role_code').order('role_code')
    ]);

    const deptCodes = depts?.map(d => d.dept_code).filter(Boolean) || [];
    const roleCodes = roles?.map(r => r.role_code).filter(Boolean) || [];
    const statuses = ['Active', 'On Leave', 'Inactive', 'Terminated'];

    // 2. Setup Workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employees');
    worksheet.columns = headers.map(h => ({ header: h, key: h, width: 25 }));

    // 3. Populate
    if (isTemplate) {
      worksheet.addRow({
        full_name: 'John Doe',
        email: 'john.doe@powerpod.com',
        phone: '+1 234 567 890',
        dept_code: deptCodes[0] || 'ENG',
        role_code: roleCodes[0] || 'SR-DEV',
        status: 'Active',
        hire_date: new Date().toISOString().split('T')[0]
      });

      // Data Validation
      const deptListStr = `"${deptCodes.join(',')}"`;
      const roleListStr = `"${roleCodes.join(',')}"`;
      const statusListStr = `"${statuses.join(',')}"`;

      for (let i = 2; i <= 101; i++) {
        if (deptCodes.length > 0) {
          worksheet.getCell(`D${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [deptListStr] };
        }
        if (roleCodes.length > 0) {
          worksheet.getCell(`E${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [roleListStr] };
        }
        worksheet.getCell(`F${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [statusListStr] };
      }
    } else {
      // Map IDs to Codes for export
      // Need to fetch maps first if exporting actual data
      const [{ data: dMap }, { data: rMap }] = await Promise.all([
        supabase.from('departments').select('id, dept_code'),
        supabase.from('employee_roles').select('id, role_code')
      ]);
      const deptMap = Object.fromEntries(dMap?.map(d => [d.id, d.dept_code]) || []);
      const roleMap = Object.fromEntries(rMap?.map(r => [r.id, r.role_code]) || []);

      data.forEach(emp => {
        worksheet.addRow({
          full_name: emp.full_name,
          email: emp.email,
          phone: emp.phone || '',
          dept_code: deptMap[emp.department_id] || '',
          role_code: roleMap[emp.role_id] || '',
          status: emp.status || 'Active',
          hire_date: emp.hire_date || ''
        });
      });
    }

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const finalFilename = filename || (isTemplate ? 'employee_template.xlsx' : `employees_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = finalFilename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <button className="halo-button csv-download-btn" onClick={handleDownload} style={{ width: '100%' }}>
      {label}
    </button>
  );
};

export default EmployeeCSVDownload;
