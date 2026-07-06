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
import { fetchApprovedSchedulesForDateRange } from '../services/employees/schedulePlannerService';
import { fetchPendingRequests } from '../services/employees/editRequestService';
import { MANAGER_SENIORITY_THRESHOLD } from '../constants/roles';

// ---------------------------------------------------------------------------
// Utility: Build the array of dates between startDate and endDate (inclusive)
// Returns an array of 'YYYY-MM-DD' strings.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Utility: Format a Date object as a YYYY-MM-DD string in IST.
//
// WHY NOT toISOString().split('T')[0]?
//   toISOString() always outputs UTC. At 01:00 IST (19:30 UTC previous day),
//   new Date().toISOString().split('T')[0] gives "yesterday" in UTC =
//   the wrong date from India's perspective.
//
// Intl.DateTimeFormat with timeZone: 'Asia/Kolkata' and locale 'en-CA'
// (which natively outputs YYYY-MM-DD) is the correct, IST-aware approach.
// This pattern is already used in attendanceService.js and is the standard.
// ---------------------------------------------------------------------------
function toISTDateString(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}

function buildDateRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate + 'T00:00:00'); // 'T00:00:00' = local midnight, avoids UTC-shift on date-only parse
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    dates.push(toISTDateString(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// ---------------------------------------------------------------------------
// Utility: Get the default start/end date for the current week (Mon–Sun) in IST.
//
// IST FIX: today.getDay() reads the browser's local time (correct for Indian
// users), but the final date output previously used toISOString().split('T')[0]
// which serialises in UTC. At 01:00 IST, this produces the wrong (UTC) date.
// Now uses toISTDateString() for all date serialisation.
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
    startDate: toISTDateString(monday),
    endDate:   toISTDateString(sunday),
  };
}

export function useAttendanceBoard(user, defaultStatus = null) {
  const { startDate: defaultStart, endDate: defaultEnd } = getDefaultWeekRange();

  // Date range state
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [hasMore, setHasMore] = useState(true);

  // Data state
  const [employees, setEmployees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [scheduledRecords, setScheduledRecords] = useState([]);
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
      const isViewer = user?.roleId === 'master_viewer' || user?.verticalPermissions?.['EMPLOYEES']?.level === 'viewer';
      const isRestricted = (user?.seniority || 0) <= MANAGER_SENIORITY_THRESHOLD || isViewer;
      const filters = {};
      
      // If the user has restricted seniority or is a viewer, only fetch their own attendance row
      if (isRestricted && user?.employeeId) {
        filters.employeeId = user.employeeId;
      }

      // Fetch in parallel — employees, attendance records, pending requests, and approved schedules
      const [employeesResult, attendanceResult, pendingResult, schedulesResult] = await Promise.all([
        fetchEmployeesForAttendance(filters, page, pageSize),
        fetchAttendanceForDateRange(startDate, endDate),
        fetchPendingRequests(),
        fetchApprovedSchedulesForDateRange(startDate, endDate),
      ]);

      if (employeesResult.error) throw employeesResult.error;
      if (attendanceResult.error) throw attendanceResult.error;
      if (schedulesResult.error) throw schedulesResult.error;
      // pendingRequests failure is non-fatal — editors may lack access, gracefully degrade
      if (pendingResult.error) {
        console.warn('[useAttendanceBoard] Could not fetch pending requests:', pendingResult.error);
      }

      setEmployees(employeesResult.data || []);
      setHasMore((employeesResult.data || []).length === pageSize);
      setAttendanceRecords(attendanceResult.data || []);
      setScheduledRecords(schedulesResult.data || []);
      setPendingRequests(pendingResult.data || []);
    } catch (err) {
      console.error('[useAttendanceBoard] fetchBoardData error:', err);
      setError(err?.message || 'Failed to load attendance board data.');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, user, page, pageSize]); // Re-fetch on date or page change

  // Initial fetch and re-fetch when date range changes
  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  // ---------------------------------------------------------------------------
  // Derived: Build the grid cell maps for fast O(1) lookup in the UI
  // ---------------------------------------------------------------------------
  const liveMap = {};
  attendanceRecords.forEach(record => {
    const key = `${record.employee_id}_${record.shift_date}`;
    liveMap[key] = record;
  });

  const scheduleMap = {};
  scheduledRecords.forEach(record => {
    const key = `${record.employee_id}_${record.shift_date}`;
    // Because the query orders by updated_at DESC, the first one we encounter
    // is the most recently approved. We only store it if it doesn't exist yet.
    if (!scheduleMap[key]) {
      scheduleMap[key] = record;
    }
  });

  // ---------------------------------------------------------------------------
  // Helper: Get the cell data for a specific employee + date combo
  // Returns the attendance record if it exists and is valid, or falls back to
  // the approved schedule, or finally a default 'absent' shell.
  // ---------------------------------------------------------------------------
  const getCellData = useCallback((employeeId, date) => {
    const key = `${employeeId}_${date}`;
    const live = liveMap[key];
    const scheduled = scheduleMap[key];

    // 1. If we have a live record in daily_attendances
    if (live) {
      // If it has actual check-in data, or it's an explicit override (like week-off/leave)
      if (live.first_login_time || live.attendance_status !== 'absent') {
        return live;
      }
    }

    // 2. If we don't have a valid live record, but we DO have an approved schedule
    if (scheduled) {
      return {
        employee_id: employeeId,
        shift_date: date,
        attendance_status: scheduled.attendance_status,
        hub_id: scheduled.hub_id,
        is_scheduled_only: true, // Optional flag for UI
        has_pending_edit: false
      };
    }

    // 3. Fallback default
    return {
      employee_id:       employeeId,
      shift_date:        date,
      attendance_status: defaultStatus || 'null',
      has_pending_edit:  false,
    };
  }, [liveMap, scheduleMap, defaultStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Data
    employees,
    dateRange,
    pendingRequests,
    
    // Pagination
    page,
    setPage,
    hasMore,

    // Controls
    startDate,
    setStartDate,
    endDate, setEndDate,
    isLoading,
    error,
    // Actions
    refreshBoard: fetchBoardData,
    getCellData,
  };
}
