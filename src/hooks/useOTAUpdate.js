/**
 * useOTAUpdate Hook
 *
 * Manages OTA update lifecycle with three distinct UI stages:
 *  1. updateDetected   — A newer version exists on GitHub. Show toast.
 *  2. isApplying       — Bundle is downloading in the background.
 *  3. downloadComplete — Bundle downloaded & applied. Show restart modal.
 *
 * Also supports manual "Update App" checks from UserProfile via
 * `checkForUpdate({ force: true })`, which bypasses the 1-hour throttle
 * and sets `manualCheckStatus` ('idle' | 'up_to_date' | 'error').
 *
 * CRITICAL: All operations are no-ops on web platform.
 *
 * Skill compliance:
 * - Runtime Stability: try/catch on all async operations
 * - Dev Best Practices: Isolated logic in hook, not in component
 * - Hybrid Mobile: Platform guarded via Capacitor.isNativePlatform()
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { otaUpdateService } from '../services/core/otaUpdateService';
import { OTA_CONFIG } from '../constants/appVersion';

const LAST_CHECK_KEY = 'ota_last_check_timestamp';
const MANUAL_STATUS_RESET_MS = 3500;

export function useOTAUpdate() {
  // updateAvailable: true once we confirm GitHub has a newer version
  const [updateAvailable, setUpdateAvailable] = useState(false);
  // updateDetected: triggers the initial pop-up toast (update found, download starting)
  const [updateDetected, setUpdateDetected] = useState(false);
  // updateVersion: the semver string of the new release (e.g. "2.3.5")
  const [updateVersion, setUpdateVersion] = useState(null);
  // isChecking: true while the GitHub API call is in flight
  const [isChecking, setIsChecking] = useState(false);
  // isApplying: true while the bundle ZIP is downloading & being applied
  const [isApplying, setIsApplying] = useState(false);
  // downloadComplete: true once the bundle is ready — triggers the restart modal
  const [downloadComplete, setDownloadComplete] = useState(false);
  // showRestartModal: user-controlled visibility of the restart prompt
  const [showRestartModal, setShowRestartModal] = useState(false);
  // manualCheckStatus: feedback for manual "Update App" taps ('idle' | 'up_to_date' | 'error')
  const [manualCheckStatus, setManualCheckStatus] = useState('idle');

  // Refs prevent stale closures & race conditions if user taps rapidly
  const inFlightRef = useRef(false);
  const statusTimerRef = useRef(null);

  // Clear feedback timer on unmount
  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  // Notify plugin on mount that the current bundle is working.
  // If a bad bundle was applied last time, this confirms the rollback succeeded.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const init = async () => {
      try {
        await otaUpdateService.notifyAppReady();
      } catch (error) {
        console.error('[useOTAUpdate] notifyAppReady failed:', error);
      }
    };

    init();
  }, []);

  // Check for updates (throttled by OTA_CONFIG.checkIntervalMs unless force: true is passed)
  const checkForUpdate = useCallback(async (options = {}) => {
    const isForced = Boolean(options && options.force === true);
    if (!Capacitor.isNativePlatform() && !isForced) return;
    if (inFlightRef.current) return;

    // Throttle automatic checks: Don't check more often than the configured interval (default: 1 hr).
    // Manual checks (force: true) bypass this throttle so users can pull updates on demand.
    if (!isForced) {
      try {
        const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
        if (lastCheck) {
          const elapsed = Date.now() - parseInt(lastCheck, 10);
          if (elapsed < OTA_CONFIG.checkIntervalMs) {
            console.log('[useOTAUpdate] Skipping check — within throttle interval');
            return;
          }
        }
      } catch (e) {
        // localStorage may not be available — proceed with check
      }
    }

    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    setManualCheckStatus('idle');
    inFlightRef.current = true;
    setIsChecking(true);

    try {
      const result = await otaUpdateService.checkForUpdate({ allowWebCheck: isForced });

      if (result.hasUpdate) {
        if (!Capacitor.isNativePlatform()) {
          // On web/dev mobile viewport: clear caches and reload into latest web assets
          if ('caches' in window) {
            try {
              const keys = await caches.keys();
              await Promise.all(keys.map(key => caches.delete(key)));
            } catch (e) { console.error(e); }
          }
          window.location.reload(true);
          return;
        }
        // Stage 1: Update detected — show the toast immediately
        setUpdateAvailable(true);
        setUpdateDetected(true);
        setUpdateVersion(result.version);
        setIsChecking(false);

        // Stage 2: Apply in the background (download is silent, user keeps working)
        setIsApplying(true);
        const applied = await otaUpdateService.applyUpdate(result.downloadUrl, result.version);
        setIsApplying(false);

        if (applied) {
          // Stage 3: Download complete — show the restart modal, dismiss the toast
          setDownloadComplete(true);
          setShowRestartModal(true);
          setUpdateDetected(false);
        }
      } else if (isForced) {
        // Provide explicit visual feedback in UserProfile when user manually checks
        const nextStatus = result.error ? 'error' : 'up_to_date';
        setManualCheckStatus(nextStatus);
        statusTimerRef.current = setTimeout(() => {
          setManualCheckStatus('idle');
        }, MANUAL_STATUS_RESET_MS);
      }

      // Record the timestamp of this successful check (only if not an API/network error)
      if (!result.error) {
        try {
          localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
        } catch (e) {
          // Ignore localStorage errors
        }
      }
    } catch (error) {
      console.error('[useOTAUpdate] Check failed:', error);
      setIsApplying(false);
      if (isForced) {
        setManualCheckStatus('error');
        statusTimerRef.current = setTimeout(() => {
          setManualCheckStatus('idle');
        }, MANUAL_STATUS_RESET_MS);
      }
    } finally {
      setIsChecking(false);
      inFlightRef.current = false;
    }
  }, []);

  // Auto-check on mount — delayed by 3 seconds to not block app startup rendering
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const timer = setTimeout(() => {
      checkForUpdate({ force: false });
    }, 3000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  /** Dismiss the initial update-detected toast (download continues in background) */
  const dismissUpdateToast = useCallback(() => {
    setUpdateDetected(false);
  }, []);

  /** Dismiss the restart modal (update will apply on next natural restart) */
  const dismissRestartModal = useCallback(() => {
    setShowRestartModal(false);
  }, []);

  return {
    updateAvailable,
    updateDetected,
    updateVersion,
    isChecking,
    isApplying,
    downloadComplete,
    showRestartModal,
    manualCheckStatus,
    checkForUpdate,
    dismissUpdateToast,
    dismissRestartModal,
  };
}
