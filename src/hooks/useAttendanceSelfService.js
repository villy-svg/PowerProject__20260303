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
  getUnmarkedPreviousShiftDay,
  claimYesterdayWeekOff,
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
// Utility: Detect whether a geolocation error is a permission denial
// Permission denials should fail fast instead of retrying coarse location.
// ---------------------------------------------------------------------------
function isLocationPermissionError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('permission') || msg.includes('denied');
}

// ---------------------------------------------------------------------------
// Utility: Capture current geolocation
// Uses Capacitor Geolocation on native (2-tier: high-accuracy GPS -> network/
// fused fallback so indoor hubs do not hit the 10s cold-GPS timeout), and
// Web Geolocation API on web.
// Returns { lat, lng, accuracy } or null if denied on web.
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

      // Tier 1: High-accuracy GPS with 15s timeout and 15s cache window
      // (avoids cold-start timeout when a recent fix is already available).
      let position;
      try {
        position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 15000,
        });
      } catch (highAccErr) {
        if (isLocationPermissionError(highAccErr)) {
          throw highAccErr;
        }
        // Tier 2: Fall back to network/fused location when GPS satellite lock
        // times out indoors (hubs, basements, warehouses).
        console.warn(
          '[useAttendanceSelfService] High-accuracy GPS failed; retrying with network/fused location:',
          highAccErr?.message
        );
        position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000,
        });
      }

      return {
        lat:      position.coords.latitude,
        lng:      position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch (err) {
      console.error('[useAttendanceSelfService] Native geolocation error:', err);
      if (isLocationPermissionError(err)) {
        throw new Error(err?.message || 'Location permission is required to update attendance. Please enable it in device settings.');
      }
      throw new Error('Could not obtain your location in time. Please ensure Location/GPS is turned on and try again.');
    }
  } else {
    // Web Geolocation API (non-fatal)
    try {
      return await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
          ()    => resolve(null),  // Denied — non-blocking on web
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      });
    } catch {
      console.warn('[useAttendanceSelfService] Web Geolocation unavailable.');
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Utility: Detect whether a session entry is still open (unchecked-out).
// Capacitor native HTTP on Android can deserialize JSONB null as the string
// "null". Treat both as open consistently across alarm, UI, and receipt logic.
// ---------------------------------------------------------------------------
function isOpenSession(session) {
  return session?.logout_time === null || session?.logout_time === 'null';
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
const STANDARD_SHIFT_MS = 11 * 60 * 60 * 1000; // 11 hours

// ---------------------------------------------------------------------------
// Utility: Schedule an 11-hour overtime alarm from a given login ISO timestamp.
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
    // Shift already exceeded 11 hours — fire immediately
    onAlarm();
    return null;
  }

  return setTimeout(onAlarm, delayMs);
}

// ---------------------------------------------------------------------------
// Utility: Fire the overtime notification.
// Attempts browser Notification API first; falls back to a state flag.
//
// Android 8 fix: The Web Notification API is not functional inside a
// Capacitor Android WebView. On some Android 8 devices, 'Notification' is
// defined in window but Notification.requestPermission() throws or never
// resolves, leaving the alarm logic stuck. We guard with isNativePlatform():
//   - Native (Android/iOS): skip directly to the reliable in-page banner.
//   - Web browser: attempt the Notification API as before (no behaviour change).
// ---------------------------------------------------------------------------
async function fireOvertimeNotification(setAlarmFired) {
  const title = '⏰ Shift Overtime Reminder';
  const body  = 'You have been on shift for 11 hours. Please remember to end your shift!';

  // Check if running inside a Capacitor native shell (Android / iOS app).
  // Dynamic import keeps @capacitor/core out of the critical web bundle path.
  let isNative = false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    isNative = Capacitor?.isNativePlatform() || false;
  } catch (e) {
    // @capacitor/core not available — definitely a web browser
  }

  if (!isNative) {
    // Web browser path: attempt the Notification API
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
  }

  // Fallback (always used on native, used on web when Notification is denied/unavailable):
  // raise the in-page alarm banner.
  setAlarmFired(true);
}

export function useAttendanceSelfService(userId) {
  // Current day's attendance for the logged-in employee
  const [todayRecord, setTodayRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);    // True during check-in/out API call
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null); // Set after action → triggers receipt screen

  // Alarm state: true when the in-page 11-hour banner should show (Notification API fallback)
  const [alarmFired, setAlarmFired] = useState(false);
  // Timer ref: holds the setTimeout ID for the overtime alarm
  const alarmTimerRef = useRef(null);

  // Form state (for the check-in form)
  const [selectedShiftType, setSelectedShiftType] = useState(getDefaultShiftType);
  const [selectedHubId, setSelectedHubId] = useState(null);

  // Phase 2: Previous-day self-service Week-Off prompt state
  const [weekOffPrompt, setWeekOffPrompt] = useState(null);
  const [isClaimingWeekOff, setIsClaimingWeekOff] = useState(false);
  const [weekOffFeedback, setWeekOffFeedback] = useState(null);
  const weekOffInFlightRef = useRef(false);

  const getWeekOffDismissKey = useCallback(
    (targetDate) => (userId && targetDate ? `pp_wo_dismissed_${userId}_${targetDate}` : null),
    [userId]
  );

  // Check if previous logical shift day is unmarked (respects 05:00 AM IST boundary)
  const loadPreviousShiftWeekOffPrompt = useCallback(async () => {
    if (!userId || userId === 'dev-bypass-user-id') return;
    try {
      const { data, error: rpcErr } = await getUnmarkedPreviousShiftDay();
      if (rpcErr || !data?.is_unmarked || !data?.target_date) {
        setWeekOffPrompt(null);
        return;
      }
      const dismissKey = getWeekOffDismissKey(data.target_date);
      if (dismissKey && localStorage.getItem(dismissKey) === '1') {
        setWeekOffPrompt(null);
        return;
      }
      setWeekOffPrompt(data);
    } catch (err) {
      console.warn('[useAttendanceSelfService] Previous-day Week-Off check skipped:', err);
    }
  }, [userId, getWeekOffDismissKey]);

  useEffect(() => {
    loadPreviousShiftWeekOffPrompt();
  }, [loadPreviousShiftWeekOffPrompt]);

  const handleDismissWeekOff = useCallback((targetDate) => {
    const dismissKey = getWeekOffDismissKey(targetDate);
    if (dismissKey) {
      try { localStorage.setItem(dismissKey, '1'); } catch { /* storage unavailable */ }
    }
    setWeekOffPrompt(null);
  }, [getWeekOffDismissKey]);

  const handleClaimWeekOff = useCallback(async (targetDate) => {
    if (!targetDate || weekOffInFlightRef.current) return;
    weekOffInFlightRef.current = true;
    setIsClaimingWeekOff(true);
    setWeekOffFeedback(null);
    try {
      const { data, error: rpcErr } = await claimYesterdayWeekOff(targetDate);
      if (rpcErr) throw rpcErr;

      setWeekOffPrompt(null);
      if (data?.status === 'marked') {
        setWeekOffFeedback({
          tone: 'success',
          message: `Week-Off recorded for ${targetDate}.`,
        });
      } else if (data?.status === 'escalated') {
        setWeekOffFeedback({
          tone: 'warning',
          message: 'Consecutive Week-Off requires manager approval — sent to your manager.',
        });
      } else if (data?.status === 'already_marked') {
        setWeekOffFeedback({
          tone: 'success',
          message: `Attendance for ${targetDate} is already recorded.`,
        });
      }
    } catch (err) {
      console.error('[useAttendanceSelfService] handleClaimWeekOff error:', err);
      setWeekOffFeedback({
        tone: 'error',
        message: err?.message || 'Could not record Week-Off. Please try again.',
      });
    } finally {
      weekOffInFlightRef.current = false;
      setIsClaimingWeekOff(false);
    }
  }, []);

  const clearWeekOffFeedback = useCallback(() => setWeekOffFeedback(null), []);

  // ---------------------------------------------------------------------------
  // Utility: Retry on Supabase AbortError (Lock Stolen)
  // ---------------------------------------------------------------------------
  const withRetry = useCallback(async (actionFn, retries = 2) => {
    let lastError;
    for (let i = 0; i <= retries; i++) {
      try {
        return await actionFn();
      } catch (err) {
        lastError = err;
        const isAbortError = err?.name === 'AbortError' || 
                             err?.message?.includes('AbortError') || 
                             err?.message?.includes('Lock was stolen');
        if (isAbortError && i < retries) {
          console.warn(`[useAttendanceSelfService] AbortError detected. Retrying... (${retries - i} left)`);
          await new Promise(r => setTimeout(r, 800));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch today's attendance record
  // ---------------------------------------------------------------------------
  const loadTodayRecord = useCallback(async () => {
    if (!userId) return; // Wait until auth provides userId
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await withRetry(async () => {
        const res = await fetchMyTodayAttendance(userId);
        if (res.error) throw res.error;
        return res;
      });
      setTodayRecord(data); // null if no record exists yet
    } catch (err) {
      console.error('[useAttendanceSelfService] loadTodayRecord error:', err);
      setError(err?.message || 'Failed to load your attendance status.');
    } finally {
      setIsLoading(false);
    }
  }, [userId, withRetry]);

  // Run on mount
  useEffect(() => {
    loadTodayRecord();
  }, [loadTodayRecord]);

  // ---------------------------------------------------------------------------
  // Auto-Update 1: Refresh when app comes to foreground (tab focus)
  // Handles stale data, shift boundary crossover (6 AM / 6 PM IST), and
  // overnight previous-day Week-Off prompt checks if left open in background.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setSelectedShiftType(getDefaultShiftType());
        loadTodayRecord();
        loadPreviousShiftWeekOffPrompt();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [loadTodayRecord, loadPreviousShiftWeekOffPrompt]);

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
    const openSession = sessions.find(isOpenSession);
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
  // An open session has a session log entry with logout_time === null or 'null'.
  // ---------------------------------------------------------------------------
  let parsedSessions = todayRecord?.session_logs_data || [];
  if (typeof parsedSessions === 'string') {
    try { parsedSessions = JSON.parse(parsedSessions); } catch (e) { parsedSessions = []; }
  }
  const hasActiveSession = !!parsedSessions.some(isOpenSession);

  // ---------------------------------------------------------------------------
  // Action: Start Shift (Check In)
  // Returns true on success, false on validation or runtime failure so callers
  // (e.g. No-Cash slide trigger) only react to confirmed check-ins.
  // ---------------------------------------------------------------------------
  const handleCheckIn = useCallback(async (hubName) => {
    if (!selectedHubId) {
      setError('Please select a hub before starting your shift.');
      return false;
    }

    // Recompute shift type at check-in time so leaving the app open across
    // 6 AM / 6 PM IST never submits a stale Day/Night shift.
    const currentShiftType = getDefaultShiftType();
    setSelectedShiftType(currentShiftType);

    setIsActing(true);
    setError(null);

    try {
      const [deviceId, geolocation] = await Promise.all([
        getDeviceId(),
        captureGeolocation(),
      ]);

      const { data } = await withRetry(async () => {
        const res = await employeeCheckIn({
          shiftType:   currentShiftType,
          hubId:       selectedHubId,
          deviceId,
          geolocation,
        });
        if (res.error) throw res.error;
        return res;
      });

      setTodayRecord(data);

      // Schedule 11-hour overtime alarm from the new session's login_time
      const newSessionsRaw = data?.session_logs_data || [];
      let newSessions = newSessionsRaw;
      if (typeof newSessions === 'string') {
        try { newSessions = JSON.parse(newSessions); } catch { newSessions = []; }
      }
      const newOpenSession = newSessions.find(isOpenSession);
      const loginTimeForAlarm = newOpenSession?.login_time || new Date().toISOString();
      if (alarmTimerRef.current) clearTimeout(alarmTimerRef.current);
      alarmTimerRef.current = scheduleOvertimeAlarm(
        loginTimeForAlarm,
        () => fireOvertimeNotification(setAlarmFired)
      );

      // Pass receipt data to trigger the WhatsApp receipt screen.
      // hubName is passed in from the HubSelector via CurrentAttendanceTab so the
      // receipt screen can show the correct hub without an async DB re-fetch.
      setSuccessData({
        action:      'checkin',
        record:      data,
        deviceId,
        geolocation,
        timestamp:   new Date().toISOString(),
        hubName:     hubName || null,
      });
      return true;
    } catch (err) {
      console.error('[useAttendanceSelfService] handleCheckIn error:', err);
      setError(err?.message || 'Check-in failed. Please try again.');
      return false;
    } finally {
      setIsActing(false);
    }
  }, [selectedHubId, withRetry]);

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

      const { data } = await withRetry(async () => {
        const res = await employeeCheckOut({ deviceId, geolocation });
        if (res.error) throw res.error;
        return res;
      });

      setTodayRecord(data);

      // Shift ended — clear the overtime alarm and dismiss any in-page banner
      if (alarmTimerRef.current) clearTimeout(alarmTimerRef.current);
      setAlarmFired(false);

      // Resolve the checkout hub name from the last session entry so the
      // receipt screen can display it without an async re-fetch that could
      // race with the useMemo that builds the WhatsApp share text.
      // This is best-effort: if it fails, hubName falls back to null and
      // AttendanceReceiptScreen shows '—' safely.
      let checkoutHubName = null;
      try {
        let sessions = data?.session_logs_data || [];
        if (typeof sessions === 'string') {
          try { sessions = JSON.parse(sessions); } catch { sessions = []; }
        }
        const lastSession = sessions[sessions.length - 1];
        if (lastSession?.hub_id) {
          const { data: hubData } = await supabase
            .from('hubs')
            .select('name')
            .eq('id', lastSession.hub_id)
            .single();
          checkoutHubName = hubData?.name || null;
        }
      } catch (hubErr) {
        console.warn('[useAttendanceSelfService] Non-fatal: could not resolve checkout hub name.', hubErr);
      }

      setSuccessData({
        action:      'checkout',
        record:      data,
        deviceId,
        geolocation,
        timestamp:   new Date().toISOString(),
        hubName:     checkoutHubName,
      });
    } catch (err) {
      console.error('[useAttendanceSelfService] handleCheckOut error:', err);
      setError(err?.message || 'Check-out failed. Please try again.');
    } finally {
      setIsActing(false);
    }
  }, [withRetry]);

  // Clear success data (e.g., when user navigates away from receipt screen)
  const clearSuccessData = useCallback(() => setSuccessData(null), []);

  // Re-open the active shift's check-in receipt so employees can re-share to
  // WhatsApp even if the app reloaded or they dismissed the receipt early.
  const openActiveSessionReceipt = useCallback((hubName) => {
    if (!todayRecord) return;
    let sessions = todayRecord.session_logs_data || [];
    if (typeof sessions === 'string') {
      try { sessions = JSON.parse(sessions); } catch { sessions = []; }
    }
    const openSession = sessions.find(isOpenSession);
    if (!openSession) return;

    const rawGeo = openSession.login_geolocation || todayRecord.login_geolocation || null;
    const validGeo = (rawGeo && typeof rawGeo.lat === 'number' && typeof rawGeo.lng === 'number')
      ? rawGeo
      : null;

    setSuccessData({
      action:      'checkin',
      record:      todayRecord,
      deviceId:    openSession.device_id || null,
      geolocation: validGeo,
      timestamp:   openSession.login_time || todayRecord.first_login_time || new Date().toISOString(),
      hubName:     hubName || null,
    });
  }, [todayRecord]);

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
    openActiveSessionReceipt,
    loadTodayRecord,
    // Phase 2: Self-Service Week-Off prompt
    weekOffPrompt,
    isClaimingWeekOff,
    weekOffFeedback,
    handleClaimWeekOff,
    handleDismissWeekOff,
    clearWeekOffFeedback,
  };
}
