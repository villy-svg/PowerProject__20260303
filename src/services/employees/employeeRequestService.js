/**
 * Employee Request Service
 * Shared logic for approval-based employee requests (bank-detail updates and
 * deactivations): server-side request creation (with deduplication & assignee
 * resolution), approval RPCs, and rejection RPC.
 * Canonical location: src/services/employees/employeeRequestService.js
 *
 * Consumers: EmployeeManagement.jsx, BankChangeRequestModal.jsx, SubmissionHistory.jsx
 */
import { supabase } from '../core/supabaseClient';

export const REQUEST_TYPES = {
  BANK_UPDATE: 'BANK_UPDATE',
  DEACTIVATION: 'EMPLOYEE_DEACTIVATION',
};

/**
 * True when the user may approve/reject employee requests:
 * master_admin / master_editor, or an Employees-vertical editor/admin.
 * Evaluated against the EMPLOYEES vertical (not the Hubs board where Escalations live).
 * @param {Object} user - Normalized user from profileService.
 */
export const canReviewEmployeeRequests = (user) => {
  if (!user) return false;
  if (user.roleId === 'master_admin' || user.roleId === 'master_editor') return true;
  const level = user.verticalPermissions?.EMPLOYEES?.level;
  return level === 'editor' || level === 'admin';
};

/**
 * True when a task row is a BANK_UPDATE or EMPLOYEE_DEACTIVATION approval request.
 * Used by Home / Track Requests so Master Admins and Employees Editors always see
 * pending employee approval requests even if the task has no linked employee_id assignee.
 * @param {Object} task
 */
export const isEmployeeApprovalTask = (task) => {
  const desc = task?.description;
  if (!desc || typeof desc !== 'string') return false;
  return (
    desc.includes(`"${REQUEST_TYPES.BANK_UPDATE}"`) ||
    desc.includes(`"${REQUEST_TYPES.DEACTIVATION}"`)
  );
};

/**
 * Safely parses the JSON payload of an employee approval task (BANK_UPDATE or EMPLOYEE_DEACTIVATION).
 * Returns null if the task is not a valid employee approval request.
 * @param {Object} task
 * @returns {Object|null}
 */
export const parseEmployeeApprovalPayload = (task) => {
  if (!isEmployeeApprovalTask(task)) return null;
  try {
    const parsed = JSON.parse(task.description);
    if (parsed && (parsed.type === REQUEST_TYPES.BANK_UPDATE || parsed.type === REQUEST_TYPES.DEACTIVATION)) {
      return parsed;
    }
  } catch (e) {
    // Not valid JSON
  }
  return null;
};

/**
 * Returns a clean, human-readable summary string for an employee approval task's description.
 * Used by mobile task cards ("Read More") so raw JSON is never displayed to users.
 * @param {Object} task
 * @returns {string}
 */
export const formatEmployeeApprovalSummary = (task) => {
  const payload = parseEmployeeApprovalPayload(task);
  if (!payload) return task?.description || '';
  if (payload.type === REQUEST_TYPES.DEACTIVATION) {
    return `${payload.requestedByName || 'An editor'} requested to mark ${payload.employeeName || 'this employee'} as Inactive. Open History to approve or reject.`;
  }
  if (payload.type === REQUEST_TYPES.BANK_UPDATE) {
    // Include PAN in mobile task summaries when present so PAN-only updates are clear to approvers
    const panPart = payload.newDetails?.panNumber ? `, PAN: ${payload.newDetails.panNumber}` : '';
    return `${payload.employeeName || 'Employee'} requested a bank details update (A/C: ${payload.newDetails?.accountNumber || 'N/A'}, IFSC: ${payload.newDetails?.ifscCode || 'N/A'}${panPart}). Open History to approve or reject.`;
  }
  return task?.description || '';
};

/**
 * Raise a deactivation approval task for an employee via the server-side RPC
 * (authorizes caller, deduplicates open requests, snapshots employee row, and
 * assigns all active Master Admins/Editors + Employees Editors/Admins).
 * @param {Object} employee
 * @returns {Promise<{status: 'created'|'duplicate', task_id: string}>}
 */
export const createDeactivationRequest = async (employee) => {
  const { data, error } = await supabase.rpc('create_employee_approval_request', {
    p_type: REQUEST_TYPES.DEACTIVATION,
    p_employee_id: employee.id,
    p_new_bank_details: null,
  });
  if (error) throw error;
  return data;
};

/**
 * Raise a bank-details update approval task for an employee via the server-side RPC.
 * @param {string} employeeId
 * @param {{accountNumber: string, ifscCode: string, accountName: string, panNumber?: string}} newBankDetails
 * @returns {Promise<{status: 'created'|'duplicate', task_id: string}>}
 */
export const createBankUpdateRequest = async (employeeId, newBankDetails) => {
  const { data, error } = await supabase.rpc('create_employee_approval_request', {
    p_type: REQUEST_TYPES.BANK_UPDATE,
    p_employee_id: employeeId,
    p_new_bank_details: newBankDetails,
  });
  if (error) throw error;
  return data;
};

/**
 * Approve a deactivation request (SECURITY DEFINER RPC).
 * Atomically repairs reporting hierarchy, marks employee Inactive, completes task, and audits.
 * @param {string} taskId
 */
export const approveDeactivationRequest = async (taskId) => {
  const { data, error } = await supabase.rpc('approve_employee_deactivation', { p_task_id: taskId });
  if (error) throw error;
  return data;
};

/**
 * Approve a bank-details update request (SECURITY DEFINER RPC).
 * Atomically verifies snapshot, updates bank columns, completes task, and audits.
 * @param {string} taskId
 */
export const approveBankUpdateRequest = async (taskId) => {
  const { data, error } = await supabase.rpc('approve_employee_bank_update', { p_task_id: taskId });
  if (error) throw error;
  return data;
};

/**
 * Reject an employee approval request (BANK_UPDATE or EMPLOYEE_DEACTIVATION).
 * Moves the task to DEPRIORITIZED and leaves the employee record untouched.
 * @param {string} taskId
 */
export const rejectEmployeeRequest = async (taskId) => {
  const { data, error } = await supabase.rpc('reject_employee_request', { p_task_id: taskId });
  if (error) throw error;
  return data;
};
