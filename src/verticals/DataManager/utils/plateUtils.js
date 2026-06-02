/**
 * plateUtils.js
 * Utility helpers for Indian EV Plate Numbers cleaning and formatting.
 */

/**
 * Normalizes Indian license plates to AB12CD1234 format.
 * Strips all spaces, hyphens, and other characters, making it uppercase.
 */
export const cleanEVPlateNumber = (plateStr) => {
  if (typeof plateStr !== 'string') return '';
  return plateStr.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};
