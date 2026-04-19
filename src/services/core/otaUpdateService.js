/**
 * OTA Update Service
 *
 * Checks GitHub Releases for new web bundle versions and applies them
 * using @capgo/capacitor-updater.
 *
 * CRITICAL: This service MUST only run on native platforms.
 * On web (GitHub Pages), all methods are no-ops.
 *
 * Skill compliance:
 * - Runtime Stability: Every async function has try/catch
 * - Hybrid Mobile: Platform guarded via Capacitor.isNativePlatform()
 * - Dev Best Practices: All imports verified
 */

import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { APP_VERSION, OTA_CONFIG } from '../../constants/appVersion';

// ── Environment Detection ──
// Determine if this build targets staging or production
// based on the Supabase URL injected at build time
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const IS_STAGING = SUPABASE_URL.includes('staging') ||
                   SUPABASE_URL.includes('nmdxitxelwlnbdrzzopc'); // staging project ref

/**
 * Determines the current environment tag prefix
 * @returns {'staging' | 'production'}
 */
function getCurrentEnvironment() {
  return IS_STAGING ? 'staging' : 'production';
}

/**
 * Checks GitHub Releases API for a newer version
 * @returns {Promise<{hasUpdate: boolean, version?: string, downloadUrl?: string}>}
 */
async function checkForUpdate() {
  // Platform guard — no-op on web
  if (!Capacitor.isNativePlatform()) {
    return { hasUpdate: false };
  }

  try {
    const env = getCurrentEnvironment();
    const prefix = OTA_CONFIG.tagPrefix[env];

    const response = await fetch(
      `https://api.github.com/repos/${OTA_CONFIG.owner}/${OTA_CONFIG.repo}/releases`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          // Public repo — no auth token needed
        },
      }
    );

    if (!response.ok) {
      console.warn(`[OTA] GitHub API returned ${response.status}`);
      return { hasUpdate: false };
    }

    const releases = await response.json();

    // Filter releases matching our environment prefix
    const relevantReleases = releases.filter(r =>
      r.tag_name.startsWith(prefix) && !r.draft && !r.prerelease
    );

    if (relevantReleases.length === 0) {
      console.log('[OTA] No releases found for environment:', env);
      return { hasUpdate: false };
    }

    // Get the latest release (GitHub returns them sorted by date, newest first)
    const latest = relevantReleases[0];
    const latestVersion = latest.tag_name.replace(prefix, '');

    // Compare versions
    if (isNewerVersion(latestVersion, APP_VERSION)) {
      // Find the bundle asset
      const bundleAsset = latest.assets.find(
        a => a.name === OTA_CONFIG.bundleAssetName
      );

      if (!bundleAsset) {
        console.warn('[OTA] Release found but no bundle asset:', latest.tag_name);
        return { hasUpdate: false };
      }

      console.log(`[OTA] Update available: ${APP_VERSION} → ${latestVersion}`);
      return {
        hasUpdate: true,
        version: latestVersion,
        downloadUrl: bundleAsset.browser_download_url,
        releaseNotes: latest.body || '',
      };
    }

    console.log('[OTA] App is up to date:', APP_VERSION);
    return { hasUpdate: false };
  } catch (error) {
    console.error('[OTA] Update check failed:', error);
    return { hasUpdate: false };
  }
}

/**
 * Downloads and applies an OTA update
 * @param {string} downloadUrl - Direct download URL for the bundle ZIP
 * @param {string} version - Version string for logging
 * @returns {Promise<boolean>} - true if update was applied
 */
async function applyUpdate(downloadUrl, version) {
  // Platform guard
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    console.log(`[OTA] Downloading bundle v${version}...`);

    // Download the bundle — capacitor-updater handles ZIP extraction
    const bundle = await CapacitorUpdater.download({
      url: downloadUrl,
      version: version,
    });

    console.log(`[OTA] Bundle downloaded. Applying...`);

    // Set the new bundle as active — it will load on next app launch
    await CapacitorUpdater.set(bundle);

    console.log(`[OTA] Update applied. Will take effect on next launch.`);
    return true;
  } catch (error) {
    console.error('[OTA] Update application failed:', error);
    return false;
  }
}

/**
 * Notifies the plugin that the current bundle is working correctly.
 * MUST be called after app successfully loads with a new bundle.
 * If not called, the plugin will roll back to the previous bundle on next launch.
 */
async function notifyAppReady() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await CapacitorUpdater.notifyAppReady();
    console.log('[OTA] App ready notification sent to updater.');
  } catch (error) {
    console.error('[OTA] notifyAppReady failed:', error);
  }
}

/**
 * Simple semantic version comparison
 * Returns true if versionA is newer than versionB
 * @param {string} versionA - e.g., "1.2.3"
 * @param {string} versionB - e.g., "1.2.0"
 * @returns {boolean}
 */
function isNewerVersion(versionA, versionB) {
  try {
    const partsA = versionA.split('.').map(Number);
    const partsB = versionB.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const a = partsA[i] || 0;
      const b = partsB[i] || 0;
      if (a > b) return true;
      if (a < b) return false;
    }
    return false; // Equal versions
  } catch (error) {
    console.error('[OTA] Version comparison failed:', error);
    return false;
  }
}

/**
 * Convenience: Check + Apply in one call
 * Returns update info for UI display
 */
async function checkAndApply() {
  if (!Capacitor.isNativePlatform()) {
    return { updated: false };
  }

  try {
    const result = await checkForUpdate();

    if (result.hasUpdate) {
      const applied = await applyUpdate(result.downloadUrl, result.version);
      return {
        updated: applied,
        version: result.version,
        releaseNotes: result.releaseNotes,
      };
    }

    return { updated: false };
  } catch (error) {
    console.error('[OTA] checkAndApply failed:', error);
    return { updated: false };
  }
}

export const otaUpdateService = {
  checkForUpdate,
  applyUpdate,
  notifyAppReady,
  checkAndApply,
  getCurrentEnvironment,
  isNewerVersion,
};
