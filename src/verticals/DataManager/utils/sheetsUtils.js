/**
 * sheetsUtils.js
 * Shared utility helpers for Google Sheets URL parsing and formatting.
 * Kept separate from validationRules.js to maintain single-responsibility.
 */

/**
 * Extracts the spreadsheet ID from a full Google Sheets URL.
 * Supports all standard Google Sheets URL formats.
 * @param {string} url - Full Google Sheets URL
 * @returns {string|null} The spreadsheet ID, or null if not found
 */
export const extractSpreadsheetId = (url) => {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

/**
 * Converts a zero-based column index to a spreadsheet column letter (A, B, ..., Z, AA, ...).
 * @param {number} index - Zero-based column index
 * @returns {string} Column letter(s)
 */
export const colIndexToLetter = (index) => {
  let letter = '';
  let i = index;
  while (i >= 0) {
    letter = String.fromCharCode(65 + (i % 26)) + letter;
    i = Math.floor(i / 26) - 1;
  }
  return letter;
};
