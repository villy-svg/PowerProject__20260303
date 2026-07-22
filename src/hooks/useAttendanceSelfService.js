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

import { useState, useEffect, useCallback, useRef } from 'react';
// Capacitor imports will be loaded dynamically if run on native platform.
import {
  fetchMyTodayAttendance,
  employeeCheckIn,
  employeeCheckOut,
} from '../services/employees/attendanceService';
import { supabase } from '../services/core/supabaseClient';
import { generateUUID } from '../utils/uuid';

// ---------------------------------------------------------------------------
// Utility: Get a stable device identifier
// Uses Capacitor Device plugin if available, falls back to localStorage UUID.
// ---------------------------------------------------------------------------
async function getDeviceId() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor?.isNativePlatform()) {
      const { Device } = await import('@capacitor/device');
      const info = await Device.getId();
      return info.identifier;
    }
  } catch (e) {
    // Fall through to web fallback
  }
  // Web fallback: generate and persist a UUID in localStorage
  let webDeviceId = localStorage.getItem('pp_device_id');
  if (!webDeviceId) {
    webDeviceId = generateUUID();
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
  let isNative = false;
  let Cap = null;
  try {
    Cap = await import('@capacitor/core');
    isNative = Cap.Capacitor?.isNativePlatform() || false;
  } catch (e) {
    // Not native
  }

  if (isNative && Cap) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      let status = await Geolocation.checkPermissions();
      
      // On every update, if not granted, request permission
      if (status.location !== 'granted') {
        status = await Geolocation.requestPermissions();
      }

      if (status.location !== 'granted') {
        throw new Error('Location permission is required to update attendance. Please enable it in device settings.');
      }

      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      return {
        lat:      position.coords.latitude,
        lng:      position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch (err) {
      console.error('[useAttendanceSelfService] Native geolocation error:', err);
      throw new Error(err?.message || 'Location permission or GPS is required to update attendance.');
    }
  } else {
    // Web Geolocation API (non-fatal)
    try {
      return await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
          ()    => resolve(null),  // Denied — non-blocking on web
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
    } catch {
      console.warn('[useAttendanceSelfService] Web Geolocation unavailable.');
      return null;
    }
  }
}

function getDefaultShiftType() {
  try {
    const options = { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' };
    const istHourStr = new Intl.DateTimeFormat('en-US', options).format(new Date());
    const istHour = parseInt(istHourStr, 10);
    // Day shift between 6 AM (6) and 6 PM (17:59), otherwise Night shift
    return (istHour >= 6 && istHour < 18) ? 'day' : 'night';
  } catch (err) {
    console.warn('[getDefaultShiftType] fallback to day shift:', err);
    return 'day';
  }
}

// ---------------------------------------------------------------------------
// Constant: standard shift length in milliseconds
// ---------------------------------------------------------------------------
const STANDARD_SHIFT_MS = 12 * 60 * 60 * 1000; // 12 hours

// ---------------------------------------------------------------------------
// Utility: Schedule a 12-hour overtime alarm from a given login ISO timestamp.
// Uses the browser Notification API if permitted, otherwise returns a flag
// that the UI component can use to show an in-page banner.
//
// Returns the setTimeout timer ID so the caller can clear it.
// ---------------------------------------------------------------------------
function scheduleOvertimeAlarm(loginTimeIso, onAlarm) {
  if (!loginTimeIso) return null;
  const loginMs = new Date(loginTimeIso).getTime();
  const alarmAtMs = loginMs + STANDARD_SHIFT_MS;
  const delayMs = alarmAtMs - Date.now();

  if (delayMs <= 0) {
    // Shift already exceeded 12 hours — fire immediately
    onAlarm();
    return null;
  }

  return setTimeout(onAlarm, delayMs);
}

// ---------------------------------------------------------------------------
// Utility: Fire the overtime notification.
// Attempts browser Notification API first; falls back to a state flag.
// ---------------------------------------------------------------------------
async function fireOvertimeNotification(setAlarmFired) {
  const title = '⏰ Shift Overtime Reminder';
  const body  = 'You have been on shift for 12 hours. Please remember to end your shift!';

  try {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // eslint-disable-next-line no-new
        new Notification(title, { body, icon: '/logos/pwa-icon-512.png' });
        return; // Notification sent — no need for in-page banner
      }
    }
  } catch (e) {
    console.warn('[useAttendanceSelfService] Notification API unavailable:', e);
  }

  // Fallback: raise in-page alarm banner
  setAlarmFired(true);
}

export function useAttendanceSelfService(userId) {
  // Current day's attendance for the logged-in employee
  const [todayRecord, setTodayRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);    // True during check-in/out API call
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null); // Set after action → triggers receipt screen

  // Alarm state: true when the in-page 12-hour banner should show (Notification API fallback)
  const [alarmFired, setAlarmFired] = useState(false);
  // Timer ref: holds the setTimeout ID for the overtime alarm
  const alarmTimerRef = useRef(null);

  // Form state (for the check-in form)
  const [selectedShiftType, setSelectedShiftType] = useState(getDefaultShiftType);
  const [selectedHubId, setSelectedHubId] = useState(null);

  // ---------------------------------------------------------------------------
  // Fetch today's attendance record
  // ---------------------------------------------------------------------------
  const loadTodayRecord = useCallback(async () => {
    if (!userId) return; // Wait until auth provides userId
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await fetchMyTodayAttendance(userId);
      if (fetchError) throw fetchError;
      setTodayRecord(data); // null if no record exists yet
    } catch (err) {
      console.error('[useAttendanceSelfService] loadTodayRecord error:', err);
      setError(err?.message || 'Failed to load your attendance status.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Run on mount
  useEffect(() => {
    loadTodayRecord();
  }, [loadTodayRecord]);

  // ---------------------------------------------------------------------------
  // Auto-Update 1: Refresh when app comes to foreground (tab focus)
  // This handles the "stale connections/data" if left open overnight
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadTodayRecord();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [loadTodayRecord]);

  // ---------------------------------------------------------------------------
  // Auto-Update 2: Realtime database subscription
  // Refreshes instantly if a manager or cron job checks the user out externally
  //
  // NOTE: We use a channelRef so the cleanup returned to React can correctly
  // call removeChannel. A dynamic import(.then()) makes the cleanup invisible
  // to React — this static approach fixes that silent memory leak.
  // ---------------------------------------------------------------------------
  const realtimeChannelRef = useRef(null);

  useEffect(() => {
    if (!todayRecord?.employee_id) return;

    // Tear down any previously subscribed channel before creating a new one
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    realtimeChannelRef.current = supabase
      .channel(`daily_attendances:self_service:${todayRecord.employee_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'daily_attendances',
          filter: `employee_id=eq.${todayRecord.employee_id}`,
        },
        (payload) => {
          console.log('[useAttendanceSelfService] Realtime update received:', payload);
          loadTodayRecord();
        }
      )
      .subscribe();

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [todayRecord?.employee_id, loadTodayRecord]);

  // ---------------------------------------------------------------------------
  // On mount: if there is already an active session (from a prior check-in),
  // re-schedule the alarm based on the existing login_time.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!todayRecord) return;
    let sessions = todayRecord?.session_logs_data || [];
    if (typeof sessions === 'string') {
      try { sessions = JSON.parse(sessions); } catch (e) { sessions = []; }
    }
    const openSession = sessions.find(s => s.logout_time === null);
    if (!openSession?.login_time) return;

    // Clear any existing timer before setting a new one
    if (alarmTimerRef.current) clearTimeout(alarmTimerRef.current);

    alarmTimerRef.current = scheduleOvertimeAlarm(
      openSession.login_time,
      () => fireOvertimeNotification(setAlarmFired)
    );

    return () => {
      if (alarmTimerRef.current) clearTimeout(alarmTimerRef.current);
    };
  }, [todayRecord]);

  // ---------------------------------------------------------------------------
  // Derived: Is there currently an open (active) session?
  // An open session has a session log entry with logout_time === null.
  // ---------------------------------------------------------------------------
  let parsedSessions = todayRecord?.session_logs_data || [];
  if (typeof parsedSessions === 'string') {
    try { parsedSessions = JSON.parse(parsedSessions); } catch (e) { parsedSessions = []; }
  }
  const hasActiveSession = !!parsedSessions.some(
    // Capacitor native HTTP on Android can deserialize JSONB null as the string "null".
    // We treat both as an open (unclosed) session to stay consistent across platforms.
    (session) => session.logout_time === null || session.logout_time === 'null'
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

      // Schedule 12-hour overtime alarm from the new session's login_time
      const newSessions = data?.session_logs_data || [];
      const newOpenSession = newSessions.find(s => s.logout_time === null);
      const loginTimeForAlarm = newOpenSession?.login_time || new Date().toISOString();
      if (alarmTimerRef.current) clearTimeout(alarmTimerRef.current);
      alarmTimerRef.current = scheduleOvertimeAlarm(
        loginTimeForAlarm,
        () => fireOvertimeNotification(setAlarmFired)
      );

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

      // Shift ended — clear the overtime alarm and dismiss any in-page banner
      if (alarmTimerRef.current) clearTimeout(alarmTimerRef.current);
      setAlarmFired(false);

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

  // Dismiss the in-page alarm banner
  const dismissAlarm = useCallback(() => setAlarmFired(false), []);

  return {
    // Data
    todayRecord,
    hasActiveSession,
    successData,
    // UI state
    isLoading,
    isActing,
    error,
    // Alarm
    alarmFired,
    dismissAlarm,
    // Form state
    selectedShiftType, setSelectedShiftType,
    selectedHubId, setSelectedHubId,
    // Actions
    handleCheckIn,
    handleCheckOut,
    clearSuccessData,
  };
}
