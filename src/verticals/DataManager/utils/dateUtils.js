/**
 * dateUtils.js
 * Utility helpers for Date Swapping detection and MM/DD/YYYY validation.
 */

/**
 * Identifies if a date belongs to a different month but swapping Month and Day
 * places it perfectly in the majority month/year.
 * Returns the corrected string (MM/DD/YYYY) or null.
 */
export const detectDateSwap = (dateStr, majorityMonth, majorityYear) => {
  if (typeof dateStr !== 'string' || majorityMonth === null || majorityYear === null) return null;

  // Split by standard date separators
  const parts = dateStr.split(/[-/]/);
  if (parts.length !== 3) return null;

  let y, m, d;
  if (parts[0].length === 4) {
    // YYYY-MM-DD
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    d = parseInt(parts[2], 10);
  } else if (parts[2].length === 4) {
    // DD-MM-YYYY or MM-DD-YYYY
    y = parseInt(parts[2], 10);
    m = parseInt(parts[0], 10);
    d = parseInt(parts[1], 10);
  } else {
    return null;
  }

  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;

  // If the parsed month is already in the majority month, no swap needed
  if (m - 1 === majorityMonth && y === majorityYear) return null;

  if (d <= 12 && d - 1 === majorityMonth && m <= 31 && y === majorityYear) {
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(d)}/${pad(m)}/${y}`;
  }

  return null;
};
