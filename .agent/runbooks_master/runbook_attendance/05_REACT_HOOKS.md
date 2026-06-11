# Phase 2.3 — React Hooks for Attendance

## Skills Required (Read Before Starting)
- `development-best-practices` §2 (Isolate business logic in hooks)
- `development-best-practices` §3 (Always catch promises, graceful empty states)
- `development-best-practices` §11 (Local vs global state — avoid over-elevating)
- `safe-code-modification` §1A (Do No Harm — do not modify existing hooks)

---

## Objective

Create two new custom hooks. These are **new files** — no existing hooks are modified:

1. `useAttendanceBoard.js` — State management for the Manager Board (date range, grid data, filters)
2. `useAttendanceSelfService.js` — State management for the Employee self-service screen (check-in/out, geolocation capture)

---

## Design Principle: Local State, Not Global

Per `development-best-practices §11`, these hooks should use **local state** inside the boards that need them. There is no need to elevate attendance state to a global context — only the Manager Board and the Self-Service screen consume this data.

---

## Step 1: Create `useAttendanceBoard.js`

**File to create:**
```
src/hooks/useAttendanceBoard.js
```

**Full JS Content:**

```javascript
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

export function useAttendanceBoard() {
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
    setIsLoading(true);
    setError(null);

    try {
      // Fetch in parallel — employees and attendance records are independent
      const [employeesResult, attendanceResult, pendingResult] = await Promise.all([
        fetchEmployeesForAttendance(),
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
```

---

## Step 2: Create `useAttendanceSelfService.js`

**File to create:**
```
src/hooks/useAttendanceSelfService.js
```

**Full JS Content:**

```javascript
/**
 * useAttendanceSelfService.js
 *
 * State management hook for the Employee Self-Service screen (check-in/out).
 * Handles: current attendance status, geolocation capture, device ID,
 * hub selection, and the check-in/out action flows.
 *
 * Skill compliance:
 *   development-best-practices §2 (Isolated business logic)
 *   development-best-practices §3 (try/catch on all async)
 *   hybrid-mobile-deployment §4 (Platform guards for Capacitor Geolocation)
 */

import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import {
  fetchMyTodayAttendance,
  employeeCheckIn,
  employeeCheckOut,
} from '../services/employees/attendanceService';

// ---------------------------------------------------------------------------
// Utility: Get a stable device identifier
// Uses Capacitor Device plugin if available, falls back to localStorage UUID.
// ---------------------------------------------------------------------------
async function getDeviceId() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Device } = await import('@capacitor/device');
      const info = await Device.getId();
      return info.identifier;
    } catch {
      // Fall through to web fallback
    }
  }
  // Web fallback: generate and persist a UUID in localStorage
  let webDeviceId = localStorage.getItem('pp_device_id');
  if (!webDeviceId) {
    webDeviceId = crypto.randomUUID();
    localStorage.setItem('pp_device_id', webDeviceId);
  }
  return webDeviceId;
}

// ---------------------------------------------------------------------------
// Utility: Capture current geolocation
// Uses Capacitor Geolocation on native, Web Geolocation API on web.
// Returns { lat, lng, accuracy } or null if denied.
// ---------------------------------------------------------------------------
async function captureGeolocation() {
  try {
    if (Capacitor.isNativePlatform()) {
      // Platform guard per hybrid-mobile-deployment §4
      await Geolocation.requestPermissions();
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      return {
        lat:      position.coords.latitude,
        lng:      position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } else {
      // Web Geolocation API
      return await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
          ()    => resolve(null),  // Denied — non-blocking, continue without geo
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
    }
  } catch {
    // Geolocation failure is non-fatal — attendance is logged without location
    console.warn('[useAttendanceSelfService] Geolocation unavailable.');
    return null;
  }
}

export function useAttendanceSelfService() {
  // Current day's attendance for the logged-in employee
  const [todayRecord, setTodayRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);    // True during check-in/out API call
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null); // Set after action → triggers receipt screen

  // Form state (for the check-in form)
  const [selectedShiftType, setSelectedShiftType] = useState('day');
  const [selectedHubId, setSelectedHubId] = useState(null);

  // ---------------------------------------------------------------------------
  // Fetch today's attendance record on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const loadTodayRecord = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await fetchMyTodayAttendance();
        if (fetchError) throw fetchError;
        setTodayRecord(data); // null if no record exists yet
      } catch (err) {
        console.error('[useAttendanceSelfService] loadTodayRecord error:', err);
        setError(err?.message || 'Failed to load your attendance status.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTodayRecord();
  }, []);

  // ---------------------------------------------------------------------------
  // Derived: Is there currently an open (active) session?
  // An open session has a session log entry with logout_time === null.
  // ---------------------------------------------------------------------------
  const hasActiveSession = !!todayRecord?.session_logs_data?.some(
    (session) => session.logout_time === null
  );

  // ---------------------------------------------------------------------------
  // Action: Start Shift (Check In)
  // ---------------------------------------------------------------------------
  const handleCheckIn = useCallback(async () => {
    if (!selectedHubId) {
      setError('Please select a hub before starting your shift.');
      return;
    }

    setIsActing(true);
    setError(null);

    try {
      const [deviceId, geolocation] = await Promise.all([
        getDeviceId(),
        captureGeolocation(),
      ]);

      const { data, error: checkInError } = await employeeCheckIn({
        shiftType:   selectedShiftType,
        hubId:       selectedHubId,
        deviceId,
        geolocation,
      });

      if (checkInError) throw checkInError;

      setTodayRecord(data);
      // Pass receipt data to trigger the WhatsApp receipt screen
      setSuccessData({
        action:      'checkin',
        record:      data,
        deviceId,
        geolocation,
        timestamp:   new Date().toISOString(),
      });
    } catch (err) {
      console.error('[useAttendanceSelfService] handleCheckIn error:', err);
      setError(err?.message || 'Check-in failed. Please try again.');
    } finally {
      setIsActing(false);
    }
  }, [selectedShiftType, selectedHubId]);

  // ---------------------------------------------------------------------------
  // Action: End Shift (Check Out)
  // ---------------------------------------------------------------------------
  const handleCheckOut = useCallback(async () => {
    setIsActing(true);
    setError(null);

    try {
      const [deviceId, geolocation] = await Promise.all([
        getDeviceId(),
        captureGeolocation(),
      ]);

      const { data, error: checkOutError } = await employeeCheckOut({ deviceId, geolocation });

      if (checkOutError) throw checkOutError;

      setTodayRecord(data);
      setSuccessData({
        action:      'checkout',
        record:      data,
        deviceId,
        geolocation,
        timestamp:   new Date().toISOString(),
      });
    } catch (err) {
      console.error('[useAttendanceSelfService] handleCheckOut error:', err);
      setError(err?.message || 'Check-out failed. Please try again.');
    } finally {
      setIsActing(false);
    }
  }, []);

  // Clear success data (e.g., when user navigates away from receipt screen)
  const clearSuccessData = useCallback(() => setSuccessData(null), []);

  return {
    // Data
    todayRecord,
    hasActiveSession,
    successData,
    // UI state
    isLoading,
    isActing,
    error,
    // Form state
    selectedShiftType, setSelectedShiftType,
    selectedHubId, setSelectedHubId,
    // Actions
    handleCheckIn,
    handleCheckOut,
    clearSuccessData,
  };
}
```

---

## Validation Checklist

- [ ] `useAttendanceBoard.js` created in `src/hooks/`
- [ ] `useAttendanceSelfService.js` created in `src/hooks/`
- [ ] `buildDateRange` utility correctly generates inclusive date array
- [ ] `getDefaultWeekRange` returns current Monday–Sunday range
- [ ] Platform guard with `Capacitor.isNativePlatform()` wraps all native calls
- [ ] Geolocation failure is non-fatal (returns null, continues check-in)
- [ ] Both `handleCheckIn` and `handleCheckOut` are wrapped in `try/catch`
- [ ] `getCellData` returns a default 'absent' shell if no record exists (prevents rendering errors)
- [ ] `hasActiveSession` correctly checks JSONB `session_logs_data` array

---

## DO NOT Proceed to Phase 3 Until All Items Above Are Checked.
