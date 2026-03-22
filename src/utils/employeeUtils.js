import { supabase } from '../services/core/supabaseClient';

/**
 * Generates a unique 6-character permanent employee code.
 */
export const generateEmpCode = () => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Calculates the dynamic Badge ID based on YY+YY+Role+Dept+Seq.
 */
export const calculateBadgeId = async (metadata, hireDate) => {
  const currentYY = new Date().getFullYear().toString().slice(-2);
  const joinYY = new Date(hireDate || new Date()).getFullYear().toString().slice(-2);
  
  // Get role and dept codes if not provided
  let rCode = metadata.role_code;
  let dCode = metadata.dept_code;

  if (!rCode || !dCode) {
    const [{ data: role }, { data: dept }] = await Promise.all([
      supabase.from('employee_roles').select('role_code').eq('id', metadata.role_id).single(),
      supabase.from('departments').select('dept_code').eq('id', metadata.department_id).single()
    ]);
    rCode = role?.role_code;
    dCode = dept?.dept_code;
  }

  const finalR = (rCode || 'XXX').slice(0, 3).padEnd(3, 'X').toUpperCase();
  const finalD = (dCode || 'X').slice(0, 1).toUpperCase();
  
  const prefix = `${currentYY}${joinYY}${finalR}${finalD}`;
  
  // Find next sequence
  const { data: similar } = await supabase
    .from('employees')
    .select('badge_id')
    .ilike('badge_id', `${prefix}%`);
  
  let nextSeq = 1;
  if (similar && similar.length > 0) {
    const seqs = similar.map(s => parseInt(s.badge_id.slice(-3)) || 0);
    nextSeq = Math.max(...seqs) + 1;
  }
  
  return `${prefix}${nextSeq.toString().padStart(3, '0')}`;
};

/**
 * Logs a change to the employee_history table.
 */
export const logEmployeeHistory = async (empId, empData, changeType, changedBy = 'Dashboard User') => {
  const historyData = {
    employee_id: empId,
    full_name: empData.full_name,
    email: empData.email,
    phone: empData.phone,
    gender: empData.gender,
    dob: empData.dob,
    hub_id: empData.hub_id,
    role_id: empData.role_id,
    department_id: empData.department_id,
    emp_code: empData.emp_code,
    badge_id: empData.badge_id,
    status: empData.status || 'Active',
    hire_date: empData.hire_date,
    account_number: empData.account_number,
    ifsc_code: empData.ifsc_code,
    account_name: empData.account_name,
    pan_number: empData.pan_number,
    changed_by: changedBy,
    change_type: changeType
  };

  const { error } = await supabase.from('employee_history').insert([historyData]);
  if (error) console.error('History logging failed:', error);
};
