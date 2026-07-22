/**
 * useLiveAttendance.js
 *
 * State management hook for the Live Attendance tab.
 * Polls for active sessions every 60 seconds, groups them by hub,
 * and computes live hours worked + overtime flag for each employee.
 *
 * Skill compliance:
 *   development-best-practices §2 (Isolated business logic)
 *   development-best-practices §3 (try/catch on all async, empty states)
 *   development-best-practices §11 (Local state only — not global context)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchLiveAttendance } from '../services/employees/attendanceService';

// ---------------------------------------------------------------------------
// Standard shift length (hours) — raises overtime flag when exceeded
// ---------------------------------------------------------------------------
const STANDARD_SHIFT_HOURS = 12;

// ---------------------------------------------------------------------------
// Poll interval: 60 seconds
// Android 8 (Chrome 64 WebView) fix: use plain integer — numeric separators
// (60_000) are ES2021 and unsupported on Android 8 WebView, causing a crash.
// ---------------------------------------------------------------------------
const POLL_INTERVAL_MS = 60000;

// ---------------------------------------------------------------------------
// Utility: Compute hours worked from a login_time ISO string to now.
// Returns a decimal (e.g. 1.5 = 1h 30m).
// ---------------------------------------------------------------------------
function computeHoursWorked(loginTimeIso) {
  if (!loginTimeIso) return 0;
  const loginMs = new Date(loginTimeIso).getTime();
  const nowMs = Date.now();
  const diffMs = nowMs - loginMs;
  if (diffMs < 0) return 0;
  return diffMs / (1000 * 60 * 60);
}

// ---------------------------------------------------------------------------
// Utility: Group raw attendance records by hub
// Returns: Array of { hub: { id, name, hub_code }, sessions: [...] }
// Each session: { employeeId, empCode, fullName, loginTime, hoursWorked, isOvertime }
// ---------------------------------------------------------------------------
function groupByHub(records, allHubsMap) {
  const hubMap = new Map(); // hub_id → { hub, sessions }

  records.forEach(record => {
    let sessions = record?.session_logs_data || [];
    if (typeof sessions === 'string') {
      try { sessions = JSON.parse(sessions); } catch(e) { sessions = []; }
    }

    // Get the open session (logout_time === null)
    const openSession = sessions.find(s => s.logout_time === null);
    if (!openSession) return; // Already checked out — skip

    // Use the session's hub_id (selected in UI), OR fallback to generic
    const sessionHubId = openSession.hub_id;
    const hub = allHubsMap.get(sessionHubId) || { 
      id: sessionHubId || 'unassigned-hub', 
      name: 'Other / Floating', 
      hub_code: 'UNASSIGNED' 
    };

    const loginTime = openSession.login_time || record.first_login_time;
    const hoursWorked = computeHoursWorked(loginTime);

    const entry = {
      recordId:    record.id,
      employeeId:  record.employee_id,
      empCode:     record.employees?.emp_code || '—',
      fullName:    record.employees?.full_name || 'Unknown',
      shiftType:   record.shift_type,
      loginTime,
      hoursWorked,
      isOvertime:  hoursWorked >= STANDARD_SHIFT_HOURS,
      sessions:    sessions,
    };

    if (!hubMap.has(hub.id)) {
      hubMap.set(hub.id, { hub, sessions: [] });
    }
    hubMap.get(hub.id).sessions.push(entry);
  });

  // Sort sessions within each hub alphabetically by name
  const hubGroups = Array.from(hubMap.values());
  hubGroups.forEach(group => {
    group.sessions.sort((a, b) => a.fullName.localeCompare(b.fullName));
  });

  // Sort hubs alphabetically by hub name
  hubGroups.sort((a, b) => a.hub.name.localeCompare(b.hub.name));

  return hubGroups;
}

export function useLiveAttendance() {
  const [hubGroups, setHubGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const pollTimerRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Fetch and process live attendance data
  // ---------------------------------------------------------------------------
  const refresh = useCallback(async () => {
    setError(null);
    try {
      // Import supabase to fetch hubs dict
      const { supabase } = await import('../services/core/supabaseClient');
      const [attendanceRes, hubsRes] = await Promise.all([
        fetchLiveAttendance(),
        supabase.from('hubs').select('id, name, hub_code')
      ]);

      if (attendanceRes.error) throw attendanceRes.error;
      if (hubsRes.error) throw hubsRes.error;

      const allHubsMap = new Map();
      (hubsRes.data || []).forEach(h => allHubsMap.set(h.id, h));

      const grouped = groupByHub(attendanceRes.data || [], allHubsMap);
      setHubGroups(grouped);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[useLiveAttendance] refresh error:', err);
      setError(err?.message || 'Failed to load live attendance data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // On mount: initial fetch + set up poll every 60s
  // ---------------------------------------------------------------------------
  useEffect(() => {
    refresh();

    // Set up recurring poll
    pollTimerRef.current = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      // Clean up poll on unmount
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [refresh]);

  // ---------------------------------------------------------------------------
  // Derived: total count of currently logged-in employees
  // ---------------------------------------------------------------------------
  const totalActive = hubGroups.reduce((sum, g) => sum + g.sessions.length, 0);

  return {
    hubGroups,
    totalActive,
    isLoading,
    error,
    lastRefresh,
    refresh,
    STANDARD_SHIFT_HOURS,
  };
}
