import { supabase } from '../../../services/core/supabaseClient';

export const leaveService = {
  /**
   * Fetch the ledger transactions for a user
   */
  getWalletLedger: async (userId, fetchAll = false) => {
    let query = supabase
      .from('employee_leave_ledgers')
      .select(`
        *,
        employee_leave_requests ( start_date, end_date ),
        employees!employee_id ( full_name )
      `)
      .order('created_at', { ascending: false });

    if (!fetchAll && userId) {
      query = query.eq('employee_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  /**
   * Compute current balance (SUM of ledger amounts)
   */
  getWalletBalance: async (userId) => {
    const { data, error } = await supabase
      .from('employee_leave_ledgers')
      .select('amount')
      .eq('employee_id', userId);

    if (error) throw error;
    
    const balance = data.reduce((acc, curr) => acc + Number(curr.amount), 0);
    return balance;
  },

  /**
   * Fetch user's leave requests
   */
  getLeaveRequests: async (userId, fetchAll = false) => {
    let query = supabase
      .from('employee_leave_requests')
      .select('*, employees!employee_id ( full_name )')
      .order('created_at', { ascending: false });

    if (!fetchAll && userId) {
      query = query.eq('employee_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  /**
   * Submit a new leave request
   */
  submitLeaveRequest: async (requestData) => {
    // requestData expected: { employee_id, start_date, end_date, days_requested, reason, status }
    const { data, error } = await supabase
      .from('employee_leave_requests')
      .insert([requestData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Approve a leave request (Admin only)
   */
  approveLeaveRequest: async (requestId, adminEmployeeId) => {
    const { data, error } = await supabase.rpc('approve_leave_request', {
      p_request_id: requestId,
      p_admin_employee_id: adminEmployeeId
    });

    if (error) throw error;
    return data;
  },

  /**
   * Reject a leave request (Admin only)
   */
  rejectLeaveRequest: async (requestId) => {
    const { data, error } = await supabase.rpc('reject_leave_request', {
      p_request_id: requestId
    });

    if (error) throw error;
    return data;
  },

  /**
   * Manually adjust wallet balance (Admin only)
   */
  addManualAdjustment: async (employeeId, amount, description, adminEmployeeId) => {
    const { data, error } = await supabase
      .from('employee_leave_ledgers')
      .insert([{
        employee_id: employeeId,
        transaction_type: 'MANUAL_ADJUSTMENT',
        amount: amount,
        description: description,
        created_by: adminEmployeeId
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
