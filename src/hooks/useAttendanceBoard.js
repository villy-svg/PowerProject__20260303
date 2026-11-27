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

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchAttendanceForDateRange,
  fetchAllEmployeesForAttendanceSearch,
  fetchAllHubsLookup,
} from '../services/employees/attendanceService';
import { fetchApprovedSchedulesForDateRange } from '../services/employees/schedulePlannerService';
import { fetchPendingRequests } from '../services/employees/editRequestService';
import { MANAGER_SENIORITY_THRESHOLD } from '../constants/roles';
import {
  buildDateRange,
  getDefaultWeekRange,
} from '../verticals/Employees/attendance/utils/attendanceDateUtils';

export function useAttendanceBoard(user, defaultStatus = null) {
  const { startDate: defaultStart, endDate: defaultEnd } = getDefaultWeekRange();

  // Date range state
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  // Pagination state (client-side slice over allEmployees to avoid redundant DB queries)
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  // Data state
  const [allEmployees, setAllEmployees] = useState([]);
  const [hubsLookup, setHubsLookup] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [scheduledRecords, setScheduledRecords] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);

  // Derived: O(1) hub lookup map for resolving non-native & multi-hub shift badges
  const hubMap = useMemo(() => {
    const map = new Map();
    (hubsLookup || []).forEach((h) => {
      if (h?.id) map.set(String(h.id), h);
    });
    return map;
  }, [hubsLookup]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Derived: all dates in current range (for the X-axis of the grid)
  const dateRange = useMemo(() => buildDateRange(startDate, endDate), [startDate, endDate]);

  // Derived: paginated slice from allEmployees (eliminates redundant paginated DB query)
  const employees = useMemo(() => {
    const startIdx = (page - 1) * pageSize;
    return allEmployees.slice(startIdx, startIdx + pageSize);
  }, [allEmployees, page, pageSize]);

  const hasMore = page * pageSize < allEmployees.length;

  // ---------------------------------------------------------------------------
  // Fetch active employees once per user session (used for both board & search)
  // ---------------------------------------------------------------------------
  const loadEmployees = useCallback(async () => {
    if (!user) return;

    // RBAC-only scoping (seniority threshold removed):
    //   - Global non-viewer roles & EMPLOYEES admin/editor see all active employees.
    //   - EMPLOYEES viewer / master_viewer are restricted to self-only (matches daily_attendances RLS).
    //   - EMPLOYEES contributor managers see their entire downward reporting tree (self + reportees).
    const roleId = user?.roleId || '';
    const empVerticalLevel = user?.verticalPermissions?.['EMPLOYEES']?.level || 'none';
    const isMasterNonViewer = roleId.startsWith('master_') && roleId !== 'master_viewer';
    const isViewer =
      roleId === 'master_viewer' ||
      (!isMasterNonViewer && (empVerticalLevel === 'viewer' || empVerticalLevel === 'none'));
    const hasOrgWideScope =
      isMasterNonViewer || empVerticalLevel === 'admin' || empVerticalLevel === 'editor';

    const filters = {};

    if (isViewer) {
      if (!user?.employeeId) {
        setAllEmployees([]);
        return;
      }
      filters.employeeId = user.employeeId;
    } else if (!hasOrgWideScope) {
      // Contributor scope: include self + all direct/indirect downward reportees regardless of seniority
      const treeIds = Array.isArray(user?.reporteeEmployeeIds)
        ? user.reporteeEmployeeIds.filter(Boolean)
        : [];
      if (treeIds.length > 0) {
        filters.employeeIds = treeIds;
      } else if (user?.employeeId) {
        filters.employeeId = user.employeeId;
      } else {
        setAllEmployees([]);
        return;
      }
    }

    const [empRes, hubsRes] = await Promise.all([
      fetchAllEmployeesForAttendanceSearch(filters),
      fetchAllHubsLookup(),
    ]);
    if (empRes.error) throw empRes.error;
    setAllEmployees(empRes.data || []);
    // Hubs lookup failure is non-fatal — board still renders without non-native badges
    if (!hubsRes.error) {
      setHubsLookup(hubsRes.data || []);
    }
  }, [user]);

  useEffect(() => {
    let isCancelled = false;
    loadEmployees().catch((err) => {
      if (!isCancelled) {
        console.error('[useAttendanceBoard] loadEmployees error:', err);
        setError(err?.message || 'Failed to load employees.');
      }
    });
    return () => { isCancelled = true; };
  }, [loadEmployees]);

  // ---------------------------------------------------------------------------
  // Fetch attendance records, pending requests, and approved schedules for range
  // ---------------------------------------------------------------------------
  const fetchBoardData = useCallback(async () => {
    if (!startDate || !endDate) {
      return; // Guard against empty or cleared date inputs
    }
    setIsLoading(true);
    setError(null);

    try {
      const [attendanceResult, pendingResult, schedulesResult] = await Promise.all([
        fetchAttendanceForDateRange(startDate, endDate),
        fetchPendingRequests(),
        fetchApprovedSchedulesForDateRange(startDate, endDate),
      ]);

      if (attendanceResult.error) throw attendanceResult.error;
      if (schedulesResult.error) throw schedulesResult.error;
      // pendingRequests failure is non-fatal — non-editors may lack access, gracefully degrade
      if (pendingResult.error) {
        console.warn('[useAttendanceBoard] Could not fetch pending requests:', pendingResult.error);
      }

      setAttendanceRecords(attendanceResult.data || []);
      setScheduledRecords(schedulesResult.data || []);
      setPendingRequests(pendingResult.data || []);
    } catch (err) {
      console.error('[useAttendanceBoard] fetchBoardData error:', err);
      setError(err?.message || 'Failed to load attendance board data.');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  // Initial fetch and re-fetch when date range changes
  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  // ---------------------------------------------------------------------------
  // Derived: Memoized grid cell maps for fast O(1) lookup and stable getCellData ref
  // ---------------------------------------------------------------------------
  const liveMap = useMemo(() => {
    const map = {};
    attendanceRecords.forEach(record => {
      map[`${record.employee_id}_${record.shift_date}`] = record;
    });
    return map;
  }, [attendanceRecords]);

  const scheduleMap = useMemo(() => {
    const map = {};
    scheduledRecords.forEach(record => {
      const key = `${record.employee_id}_${record.shift_date}`;
      // Query orders by updated_at DESC — first encountered is most recently approved.
      if (!map[key]) {
        map[key] = record;
      }
    });
    return map;
  }, [scheduledRecords]);

  // ---------------------------------------------------------------------------
  // Helper: Get the cell data for a specific employee + date combo
  // Returns the attendance record if it exists and is valid, or falls back to
  // the approved schedule, or finally a default 'null' shell.
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
        is_scheduled_only: true,
        has_pending_edit: false,
      };
    }

    // 3. Fallback default
    return {
      employee_id:       employeeId,
      shift_date:        date,
      attendance_status: defaultStatus || 'null',
      has_pending_edit:  false,
    };
  }, [liveMap, scheduleMap, defaultStatus]);

  return {
    // Data
    employees,
    allEmployees,
    hubMap,
    dateRange,
    pendingRequests,

    // Pagination
    page,
    setPage,
    hasMore,

    // Controls
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    isLoading,
    error,
    // Actions
    refreshBoard: fetchBoardData,
    getCellData,
  };
}
