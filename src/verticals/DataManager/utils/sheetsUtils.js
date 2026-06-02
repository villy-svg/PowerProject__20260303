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

/**
 * Scans the first few rows of a spreadsheet tab to estimate where the column headers are
 * based on recognized unique core column patterns (date, plate, vehicle, soc, units, battery).
 * Returns the estimated index to skip (e.g. 0 if headers are in row 1, 3 if headers are in row 4).
 * @param {Array[]} rows - Tab rows matrix
 * @returns {number} Estimated headerRowsToSkip count
 */
export const estimateHeaderRowsToSkip = (rows) => {
  if (!rows || rows.length === 0) return 0;
  
  let bestIdx = 0;
  let maxUniqueMatches = 0;
  
  // Define core column types and their associated keyword patterns
  const coreGroups = [
    { type: 'date', keywords: ['date', 'dt', 'timestamp', 'time'] },
    { type: 'plate', keywords: ['plate', 'vehicle', 'reg', 'registration', 'vno', 'veh'] },
    { type: 'soc', keywords: ['soc', 'state of charge', 'charge', 'battery %', 'battery pct'] },
    { type: 'units', keywords: ['units', 'consumed', 'consumption', 'kwh', 'energy'] },
    { type: 'battery', keywords: ['battery', 'capacity', 'size'] }
  ];
  
  // Scan the first 20 rows for maximum robustness
  const scanLimit = Math.min(rows.length, 20);
  for (let idx = 0; idx < scanLimit; idx++) {
    const row = rows[idx];
    if (!Array.isArray(row)) continue;
    
    // Set to keep track of which core groups have at least one cell matching in this row
    const matchedGroups = new Set();
    
    row.forEach(cell => {
      const val = String(cell || '').toLowerCase().trim();
      if (val) {
        coreGroups.forEach(group => {
          const isMatch = group.keywords.some(kw => val.includes(kw));
          if (isMatch) {
            matchedGroups.add(group.type);
          }
        });
      }
    });
    
    if (matchedGroups.size > maxUniqueMatches) {
      maxUniqueMatches = matchedGroups.size;
      bestIdx = idx;
    }
  }
  
  // Suggest the row index if it contains at least 2 unique core matching headers, else fallback to 0
  return maxUniqueMatches >= 2 ? bestIdx : 0;
};
