/**
 * validationRules.js
 * Decoupled, pure validation engine for vehicle transaction spreadsheet rows.
 * Now supports formula evaluation, plate normalization, majority month detection,
 * fleet master cross-referencing, and intelligent Month-Day date swap detection.
 */

/**
 * Safely evaluates simple row-level spreadsheet formulas (e.g. =D12-E12).
 */
export const evaluateFormula = (formulaStr, rowCells, headers, colIdx = null, visited = new Set()) => {
  if (typeof formulaStr !== 'string' || !formulaStr.startsWith('=')) {
    return formulaStr;
  }

  if (colIdx !== null) {
    if (visited.has(colIdx)) {
      return '#REF!';
    }
    visited.add(colIdx);
  }

  try {
    let expr = formulaStr.substring(1).toUpperCase();
    const cellRefRegex = /([A-Z]+)([0-9]+)/g;
    
    expr = expr.replace(cellRefRegex, (match, colLetter) => {
      const targetColIdx = colLetter.charCodeAt(0) - 65; // A=0, B=1, ...
      if (targetColIdx >= 0 && targetColIdx < rowCells.length) {
        const val = rowCells[targetColIdx];
        const resolvedVal = (typeof val === 'string' && val.startsWith('=')) 
          ? evaluateFormula(val, rowCells, headers, targetColIdx, new Set(visited))
          : val;
          
        const num = parseFloat(resolvedVal);
        return isNaN(num) ? '0' : String(num);
      }
      return '0';
    });

    const safeExpr = expr.replace(/[^0-9+\-*/().\s]/g, '');
    if (!safeExpr.trim()) return '0';
    
    const result = Function(`"use strict"; return (${safeExpr})`)();
    return typeof result === 'number' && !isNaN(result) ? Number(result.toFixed(2)) : '0';
  } catch (err) {
    console.error('Formula evaluation error:', err);
    return '#VALUE!';
  }
};

/**
 * Normalizes Indian license plates to AB12CD1234 format.
 */
export const cleanEVPlateNumber = (plateStr) => {
  if (typeof plateStr !== 'string') return '';
  return plateStr.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

/**
 * Identifies if a date belongs to a different month but swapping Month and Day
 * places it perfectly in the majority month/year.
 * Returns the corrected string (YYYY-MM-DD) or null.
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

  // Swap check: if day 'd' is a valid month (<= 12) and matches majority month,
  // and month 'm' is a valid day (<= 31), we have a month-day swap match!
  if (d <= 12 && d - 1 === majorityMonth && m <= 31 && y === majorityYear) {
    const pad = (num) => String(num).padStart(2, '0');
    return `${y}-${pad(d)}-${pad(m)}`;
  }

  return null;
};

/**
 * Validates a single row against our business rules.
 */
export const validateRow = (row, headers, context = {}) => {
  const errors = {};
  
  // Rule 1: Skip completely empty rows, but flag partially filled rows
  const isRowCompletelyEmpty = row.every(val => val === undefined || val === null || String(val).trim() === '');
  if (isRowCompletelyEmpty) return null;

  headers.forEach((header, colIdx) => {
    let value = row[colIdx];
    const headerLower = (header || '').toLowerCase().trim();

    if (!headerLower) return;

    // Evaluate formula if present before validating
    if (typeof value === 'string' && value.startsWith('=')) {
      value = evaluateFormula(value, row, headers, colIdx);
    }

    // Flag empty cells in a partially filled row
    if (value === undefined || value === null || String(value).trim() === '') {
      errors[colIdx] = { message: `${header} cannot be empty.` };
      return;
    }

    const strVal = String(value).trim();

    // Rule: Date validation
    if (headerLower.includes('date')) {
      const date = new Date(strVal);
      if (isNaN(date.getTime())) {
        errors[colIdx] = { message: 'Invalid Date format (use YYYY-MM-DD).' };
      } else if (context.majorityMonth !== undefined && context.majorityMonth !== null && context.majorityYear) {
        // Run Month-Day Swap Detector
        const swappedSuggestion = detectDateSwap(strVal, context.majorityMonth, context.majorityYear);
        
        if (swappedSuggestion) {
          errors[colIdx] = {
            message: `Month/Day swap detected. Swapping yields ${swappedSuggestion}.`,
            isDateSwap: true,
            suggestedValue: swappedSuggestion
          };
        } else if (date.getMonth() !== context.majorityMonth || date.getFullYear() !== context.majorityYear) {
          // General date abruptness
          const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          errors[colIdx] = { message: `Abrupt Date: Expected ${monthNames[context.majorityMonth]} ${context.majorityYear}.` };
        }
      }
    }

    // Rule: EV Plate Number validation
    if (headerLower.includes('plate number') || headerLower.includes('vehicle number')) {
      const cleanedPlate = cleanEVPlateNumber(strVal);
      const indianPlateRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;
      
      if (!indianPlateRegex.test(cleanedPlate)) {
        errors[colIdx] = { message: 'Invalid Indian Plate format (Expected e.g. MH12AB1234).' };
      } else if (context.vehiclePlates && !context.vehiclePlates.has(cleanedPlate)) {
        errors[colIdx] = { message: `Plate not found in Vehicle Details fleet master.` };
      }
    }

    // Rule: SoC Range [0, 100]
    if (headerLower.includes('soc')) {
      const num = parseFloat(strVal);
      if (isNaN(num) || num < 0 || num > 100) {
        errors[colIdx] = { message: 'SoC must be between 0 and 100.' };
      }
    }

    // Rule: Positive Numbers for consumed units & battery size
    if (headerLower.includes('units consumed') || headerLower.includes('battery size')) {
      const num = parseFloat(strVal);
      if (isNaN(num) || num < 0) {
        errors[colIdx] = { message: 'Must be positive.' };
      }
    }
  });

  return Object.keys(errors).length > 0 ? errors : null;
};

/**
 * Validates the entire sheet of rows.
 */
export const validateSheet = (rows, headers, context = {}) => {
  const errors = {};
  
  // Step 1: Detect majority month and year for Date Abruptness
  let monthCounts = {};
  let yearCounts = {};
  
  headers.forEach((header, colIdx) => {
    if ((header || '').toLowerCase().trim().includes('date')) {
      rows.forEach(row => {
        const val = row[colIdx];
        if (val && !String(val).startsWith('=')) {
          const date = new Date(val);
          if (!isNaN(date.getTime())) {
            const m = date.getMonth();
            const y = date.getFullYear();
            monthCounts[m] = (monthCounts[m] || 0) + 1;
            yearCounts[y] = (yearCounts[y] || 0) + 1;
          }
        }
      });
    }
  });

  // Find month & year with maximum occurrences
  let majorityMonth = null;
  let maxMonthCount = 0;
  Object.entries(monthCounts).forEach(([m, count]) => {
    if (count > maxMonthCount) {
      maxMonthCount = count;
      majorityMonth = parseInt(m, 10);
    }
  });

  let majorityYear = null;
  let maxYearCount = 0;
  Object.entries(yearCounts).forEach(([y, count]) => {
    if (count > maxYearCount) {
      maxYearCount = count;
      majorityYear = parseInt(y, 10);
    }
  });

  const fullContext = {
    ...context,
    majorityMonth,
    majorityYear
  };

  // Step 2: Validate each row using the established context
  rows.forEach((row, idx) => {
    const actualRowIndex = idx + 1; // 1-indexed to match data rows (skipping header)
    const rowErrors = validateRow(row, headers, fullContext);
    if (rowErrors) {
      errors[actualRowIndex] = rowErrors;
    }
  });
  
  return errors;
};
