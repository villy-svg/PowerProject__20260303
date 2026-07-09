import { supabase } from '../../../services/core/supabaseClient';

export const leaveService = {
  /**
   * Fetch the ledger transactions for a user
   */
  getWalletLedger: async (userId) => {
    const { data, error } = await supabase
      .from('employee_leave_ledgers')
      .select(`
        *,
        employee_leave_requests ( start_date, end_date )
      `)
      .eq('employee_id', userId)
      .order('created_at', { ascending: false });

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
  getLeaveRequests: async (userId) => {
    const { data, error } = await supabase
      .from('employee_leave_requests')
      .select('*')
      .eq('employee_id', userId)
      .order('created_at', { ascending: false });

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
  }
};
