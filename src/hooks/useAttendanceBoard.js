/**
 * useAttendanceBoard.js
 *
 * State management hook for the Manager's Attendance Board.
 * Handles: date range selection, employee list, attendance data fetching,
 * and grid cell state (merging employees + records into a unified grid).
 *
 * Skill compliance:
 *   development-best-practices §2 (Isolated business logic)
 *   development-best-practices §3 (try/catch on all async, empty states)
 *   development-best-practices §11 (Local state only — not global context)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchAttendanceForDateRange,
  fetchEmployeesForAttendance,
} from '../services/employees/attendanceService';
import { fetchPendingRequests } from '../services/employees/editRequestService';
import { MANAGER_SENIORITY_THRESHOLD } from '../constants/roles';

// ---------------------------------------------------------------------------
// Utility: Build the array of dates between startDate and endDate (inclusive)
// Returns an array of 'YYYY-MM-DD' strings.
// ---------------------------------------------------------------------------
function buildDateRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// ---------------------------------------------------------------------------
// Utility: Get the default start/end date for the current week (Mon–Sun)
// ---------------------------------------------------------------------------
function getDefaultWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Adjust so week starts on Monday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    startDate: monday.toISOString().split('T')[0],
    endDate:   sunday.toISOString().split('T')[0],
  };
}

export function useAttendanceBoard(user) {
  const { startDate: defaultStart, endDate: defaultEnd } = getDefaultWeekRange();

  // Date range state
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  // Data state
  const [employees, setEmployees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Derived: all dates in current range (for the X-axis of the grid)
  const dateRange = buildDateRange(startDate, endDate);

  // ---------------------------------------------------------------------------
  // Fetch all data for the board: employees + attendance records + pending requests
  // ---------------------------------------------------------------------------
  const fetchBoardData = useCallback(async () => {
    if (!startDate || !endDate) {
      return; // Guard against empty or cleared date inputs
    }
    setIsLoading(true);
    setError(null);

    try {
      const isRestricted = (user?.seniority || 0) <= MANAGER_SENIORITY_THRESHOLD;
      const filters = {};
      
      // If the user has restricted seniority, only fetch their own attendance row
      if (isRestricted && user?.employeeId) {
        filters.employeeId = user.employeeId;
      }

      // Fetch in parallel — employees and attendance records are independent
      const [employeesResult, attendanceResult, pendingResult] = await Promise.all([
        fetchEmployeesForAttendance(filters),
        fetchAttendanceForDateRange(startDate, endDate),
        fetchPendingRequests(),
      ]);

      if (employeesResult.error) throw employeesResult.error;
      if (attendanceResult.error) throw attendanceResult.error;
      // pendingRequests failure is non-fatal — editors may lack access, gracefully degrade
      if (pendingResult.error) {
        console.warn('[useAttendanceBoard] Could not fetch pending requests:', pendingResult.error);
      }

      setEmployees(employeesResult.data || []);
      setAttendanceRecords(attendanceResult.data || []);
      setPendingRequests(pendingResult.data || []);
    } catch (err) {
      console.error('[useAttendanceBoard] fetchBoardData error:', err);
      setError(err?.message || 'Failed to load attendance data.');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  // Initial fetch and re-fetch when date range changes
  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  // ---------------------------------------------------------------------------
  // Derived: Build the grid cell map for fast O(1) lookup in the UI
  // Key: `${employeeId}_${shiftDate}` → attendance record (or null if absent)
  // ---------------------------------------------------------------------------
  const cellMap = {};
  attendanceRecords.forEach(record => {
    const key = `${record.employee_id}_${record.shift_date}`;
    cellMap[key] = record;
  });

  // ---------------------------------------------------------------------------
  // Helper: Get the cell data for a specific employee + date combo
  // Returns the attendance record if it exists, or a default 'absent' shell.
  // ---------------------------------------------------------------------------
  const getCellData = useCallback((employeeId, date) => {
    const key = `${employeeId}_${date}`;
    return cellMap[key] || {
      employee_id:       employeeId,
      shift_date:        date,
      attendance_status: 'absent',
      has_pending_edit:  false,
    };
  }, [attendanceRecords]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Data
    employees,
    attendanceRecords,
    pendingRequests,
    dateRange,
    // State
    startDate, setStartDate,
    endDate, setEndDate,
    isLoading,
    error,
    // Actions
    refreshBoard: fetchBoardData,
    getCellData,
  };
}
