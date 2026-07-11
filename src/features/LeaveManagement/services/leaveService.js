import { supabase } from '../../../services/core/supabaseClient';

export const leaveService = {
  /**
   * Fetch the ledger transactions for a user (paginated)
   */
  getWalletLedger: async (userId, fetchAll = false, page = 1, pageSize = 50) => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('v_employee_leave_ledgers_with_balance')
      .select(`
        *,
        attendance_edit_requests!reference_edit_request_id ( shift_date, maker_note ),
        employees!employee_id ( full_name )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!fetchAll && userId) {
      query = query.eq('employee_id', userId);
    }

    const { data, error, count } = await query;

    if (error) throw error;
    return { data, count };
  },

  /**
   * Compute current balance (SUM of ledger amounts) grouped by leave type
   */
  getWalletBalance: async (userId) => {
    const { data, error } = await supabase
      .from('employee_leave_ledgers')
      .select('amount, leave_type')
      .eq('employee_id', userId);

    if (error) throw error;
    
    const balances = { PL: 0, SL: 0, CL: 0, COMP_OFF: 0 };
    data.forEach(curr => {
      if (!balances[curr.leave_type]) balances[curr.leave_type] = 0;
      balances[curr.leave_type] += Number(curr.amount);
    });
    return balances;
  },

  /**
   * Fetch user's leave requests from the Attendance Maker-Checker infra (paginated)
   */
  getLeaveRequests: async (userId, fetchAll = false, page = 1, pageSize = 50) => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('attendance_edit_requests')
      .select('*, employees!employee_id ( full_name )', { count: 'exact' })
      .eq('suggested_status', 'leave')
      .order('shift_date', { ascending: false })
      .range(from, to);

    if (!fetchAll && userId) {
      query = query.eq('employee_id', userId);
    }

    const { data, error, count } = await query;

    if (error) throw error;
    return { data, count };
  },

  /**
   * Get the default leave type for an employee based on their policy
   */
  getDefaultLeaveType: async (employeeId) => {
    const { data, error } = await supabase
      .from('employees')
      .select(`
        employee_roles!inner (
          employee_leave_policies (
            default_leave_type
          )
        )
      `)
      .eq('id', employeeId)
      .single();

    if (error) {
      console.warn('Error fetching default leave type:', error);
      return 'SL';
    }

    try {
      return data.employee_roles.employee_leave_policies[0].default_leave_type || 'SL';
    } catch (e) {
      return 'SL';
    }
  },

  /**
   * Calculate actual leave days between two dates, skipping week-offs/holidays
   */
  calculateActualLeaveDays: async (employeeId, startDateStr, endDateStr) => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays <= 0) return 0;

    const { data: existingAtt } = await supabase
      .from('daily_attendances')
      .select('shift_date, attendance_status')
      .eq('employee_id', employeeId)
      .gte('shift_date', startDateStr)
      .lte('shift_date', endDateStr);
      
    let skipCount = 0;
    if (existingAtt) {
      existingAtt.forEach(att => {
        if (att.attendance_status === 'week-off' || att.attendance_status === 'public-holiday') {
          skipCount++;
        }
      });
    }
    return Math.max(0, diffDays - skipCount);
  },

  /**
   * Submit a new leave request (by inserting into Attendance Edit Requests)
   */
  submitLeaveRequest: async (requestData, requestedBy, leaveType = 'PL') => {
    // requestData expected: { employee_id, start_date, end_date, reason }
    const start = new Date(requestData.start_date);
    const end = new Date(requestData.end_date);
    
    // Fetch existing attendance to skip week-offs and public holidays (if any are pre-populated)
    const { data: existingAtt } = await supabase
      .from('daily_attendances')
      .select('shift_date, attendance_status')
      .eq('employee_id', requestData.employee_id)
      .gte('shift_date', requestData.start_date)
      .lte('shift_date', requestData.end_date);
      
    const skipDates = new Set();
    if (existingAtt) {
      existingAtt.forEach(att => {
        if (att.attendance_status === 'week-off' || att.attendance_status === 'public-holiday') {
          skipDates.add(att.shift_date);
        }
      });
    }

    const payloads = [];
    
    // Loop through each day in the date range
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      if (skipDates.has(dateStr)) continue;
      
      payloads.push({
        employee_id: requestData.employee_id,
        shift_date: dateStr,
        suggested_status: 'leave',
        maker_note: requestData.reason,
        requested_by: requestedBy,
        request_status: 'pending',
        suggested_leave_type: leaveType
      });
    }

    if (payloads.length === 0) return []; // Nothing to insert

    const { data, error } = await supabase
      .from('attendance_edit_requests')
      .insert(payloads)
      .select();

    if (error) throw error;
    return data;
  },

  /**
   * Manually adjust wallet balance (Admin only)
   */
  addManualAdjustment: async (employeeId, amount, description, adminEmployeeId, leaveType = 'SL') => {
    const { data, error } = await supabase
      .from('employee_leave_ledgers')
      .insert([{
        employee_id: employeeId,
        transaction_type: 'MANUAL_ADJUSTMENT',
        amount: amount,
        description: description,
        created_by: adminEmployeeId,
        leave_type: leaveType
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Run the monthly accrual script (Admin only)
   */
  runMonthlyAccrual: async (adminEmployeeId, targetDate) => {
    const { data, error } = await supabase.rpc('run_monthly_leave_accrual', {
      p_admin_employee_id: adminEmployeeId,
      p_target_date: targetDate || new Date().toISOString().split('T')[0]
    });

    if (error) throw error;
    return data;
  }
};
