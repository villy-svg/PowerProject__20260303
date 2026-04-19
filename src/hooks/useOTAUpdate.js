/**
 * useOTAUpdate Hook
 *
 * Manages OTA update lifecycle:
 * 1. On mount, notify plugin that current bundle is healthy
 * 2. Check for updates once (respecting interval throttle)
 * 3. Expose update state for optional UI display
 *
 * CRITICAL: All operations are no-ops on web platform.
 *
 * Skill compliance:
 * - Runtime Stability: try/catch on all async operations
 * - Dev Best Practices: Isolated logic in hook, not in component
 * - Hybrid Mobile: Platform guarded via Capacitor.isNativePlatform()
 */

import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { otaUpdateService } from '../services/core/otaUpdateService';
import { OTA_CONFIG } from '../constants/appVersion';

const LAST_CHECK_KEY = 'ota_last_check_timestamp';

export function useOTAUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Notify plugin on mount that the current bundle is working
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

  // Check for updates (throttled)
  const checkForUpdate = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;

    // Throttle: Don't check more often than the configured interval
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

    setIsChecking(true);
    try {
      const result = await otaUpdateService.checkForUpdate();

      if (result.hasUpdate) {
        setUpdateAvailable(true);
        setUpdateVersion(result.version);
        // Auto-apply in background
        setIsApplying(true);
        await otaUpdateService.applyUpdate(result.downloadUrl, result.version);
        setIsApplying(false);
      }

      // Record successful check timestamp
      try {
        localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
      } catch (e) {
        // Ignore localStorage errors
      }
    } catch (error) {
      console.error('[useOTAUpdate] Check failed:', error);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Auto-check on mount
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Delay the check slightly to not block app startup
    const timer = setTimeout(checkForUpdate, 3000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  return {
    updateAvailable,
    updateVersion,
    isChecking,
    isApplying,
    checkForUpdate,
  };
}
