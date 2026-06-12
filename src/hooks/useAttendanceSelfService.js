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
// Capacitor imports will be loaded dynamically if run on native platform.
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
