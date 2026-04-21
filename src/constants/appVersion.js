/**
 * App Version Constants
 *
 * APP_VERSION must be incremented for every release.
 * It is compared against GitHub Release tags to detect OTA updates.
 *
 * Tag convention: ota-{env}-v{APP_VERSION}
 * Example: ota-staging-v1.0.0, ota-production-v1.0.0
 */

export const APP_VERSION = '2.0.1';

export const OTA_CONFIG = {
  // GitHub repository for checking releases
  owner: 'villy-svg',
  repo: 'PowerProject__20260303',

  // Tag prefixes for each environment
  tagPrefix: {
    staging: 'ota-staging-v',
    production: 'ota-production-v',
  },

  // Asset filename to download from the release
  bundleAssetName: 'ota-bundle.zip',

  // Minimum interval between update checks (milliseconds)
  // Default: 1 hour — prevents excessive API calls
  checkIntervalMs: 60 * 60 * 1000,
};
