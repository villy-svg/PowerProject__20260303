/**
 * validationRules.js
 * Decoupled, pure validation engine for vehicle transaction spreadsheet rows.
 * Focuses purely on business rules and orchestrating validations.
 */

import { evaluateFormula } from './formulaEvaluator';
import { cleanEVPlateNumber } from './plateUtils';
import { detectDateSwap } from './dateUtils';

// Re-export utility helpers to maintain a clean public API and prevent dependency breaks
export { evaluateFormula } from './formulaEvaluator';
export { cleanEVPlateNumber } from './plateUtils';
export { detectDateSwap } from './dateUtils';

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

    // Ignore extra/unnecessary columns that are not part of our core dataset
    const isCore = 
      headerLower.includes('date') ||
      headerLower.includes('plate') ||
      headerLower.includes('vehicle') ||
      headerLower.includes('soc') ||
      headerLower.includes('units') ||
      headerLower.includes('battery');
      
    if (!isCore) return;

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

    // If the value is a formula that we couldn't resolve locally (starts with '='),
    // skip validation rules since we cannot verify the final evaluated cell content here.
    if (strVal.startsWith('=')) {
      return;
    }

    // Rule: Date validation
    if (headerLower.includes('date')) {
      let date = new Date(strVal);
      let isExcelDate = false;
      
      const numVal = parseInt(strVal, 10);
      if (/^\d+$/.test(strVal) && numVal > 30000 && numVal < 70000) {
        // Excel base date is Dec 30, 1899 due to 1900 leap year bug
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        date = new Date(excelEpoch.getTime() + numVal * 24 * 60 * 60 * 1000);
        isExcelDate = true;
      }

      if (isNaN(date.getTime())) {
        errors[colIdx] = { message: 'Invalid Date format (use M/D/YYYY).' };
      } else {
        const strictDateRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
        const isStrict = strictDateRegex.test(strVal) && !isExcelDate;

        if (!isStrict) {
          const standardized = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
          errors[colIdx] = {
            message: isExcelDate 
              ? `Excel serialized date number detected (${strVal}). Click to format to M/D/YYYY.`
              : `Non-standard date format. Click to format to M/D/YYYY.`,
            isDateFormatAnomaly: true,
            suggestedValue: standardized
          };
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
    }

    // Rule: EV Plate Number validation
    if (headerLower.includes('plate number') || headerLower.includes('vehicle number')) {
      const cleanedPlate = cleanEVPlateNumber(strVal);
      const indianPlateRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;
      
      if (!indianPlateRegex.test(cleanedPlate)) {
        errors[colIdx] = { message: 'Invalid Indian Plate format (Expected e.g. MH12AB1234).' };
      } else if (strVal !== cleanedPlate) {
        // Valid plate, but has spaces, lowercase or hyphens
        errors[colIdx] = {
          message: `Non-standard plate format. Click to clean to ${cleanedPlate}.`,
          isPlateFormatAnomaly: true,
          suggestedValue: cleanedPlate
        };
      } else if (context.vehiclePlates && !context.vehiclePlates.has(cleanedPlate)) {
        errors[colIdx] = { message: `Plate not found in Vehicle Details fleet master.` };
      }
    }

    // Rule: SoC Range [0%, 100%]
    // Handles three cases:
    //   1. Decimal fraction without %, e.g. "0.52"  → likely 52%  → suggest "52%"
    //   2. Decimal fraction WITH %, e.g. "0.52%"    → likely 52%  → suggest "52%"
    //   3. Plain percentage number without %, e.g. "52" → suggest "52%"
    if (headerLower.includes('soc')) {
      if (!strVal.endsWith('%')) {
        const num = parseFloat(strVal);
        if (isNaN(num)) {
          // Non-numeric value in SoC column
          errors[colIdx] = { message: 'SoC must be a number between 0% and 100%.' };
        } else if (num > 0 && num <= 1) {
          // Almost certainly a decimal fraction (0.52 → 52%)
          const converted = Math.round(num * 100);
          errors[colIdx] = {
            message: `SoC appears to be a decimal fraction (${strVal}). Click to convert to ${converted}%.`,
            isSoCFormatAnomaly: true,
            suggestedValue: `${converted}%`
          };
        } else if (num >= 0 && num <= 100) {
          // Valid numeric value, just missing the % symbol
          errors[colIdx] = {
            message: `SoC must end with % symbol. Click to format to ${strVal}%.`,
            isSoCFormatAnomaly: true,
            suggestedValue: `${strVal}%`
          };
        } else {
          // Out-of-range value
          errors[colIdx] = { message: `SoC value (${strVal}) is out of range. Must be between 0% and 100%.` };
        }
      } else {
        // Has % suffix — strip it and validate the numeric part
        const cleanVal = strVal.slice(0, -1);
        const num = parseFloat(cleanVal);
        if (isNaN(num)) {
          errors[colIdx] = { message: 'SoC must be a valid number ending with %.' };
        } else if (num > 0 && num <= 1) {
          // Stored as "0.52%" — almost certainly means 52%
          const converted = Math.round(num * 100);
          errors[colIdx] = {
            message: `SoC appears to be a decimal fraction (${strVal}). Click to convert to ${converted}%.`,
            isSoCFormatAnomaly: true,
            suggestedValue: `${converted}%`
          };
        } else if (num < 0 || num > 100) {
          errors[colIdx] = { message: `SoC value (${strVal}) is out of range. Must be between 0% and 100%.` };
        }
        // num === 0 is valid (fully depleted), and 1 < num <= 100 is a valid percentage — no error
      }
    }

    // Rule: Positive Numbers for consumed units & battery size
    // Zero is technically valid for battery size, but suspicious for energy consumed — flag it.
    if (headerLower.includes('units consumed') || headerLower.includes('battery size')) {
      const num = parseFloat(strVal);
      if (isNaN(num)) {
        errors[colIdx] = { message: `${header} must be a valid number.` };
      } else if (num < 0) {
        errors[colIdx] = { message: `${header} cannot be negative (got ${strVal}).` };
      } else if (num === 0 && headerLower.includes('units consumed')) {
        // Zero energy consumed is suspicious — likely a missing or erroneous entry
        errors[colIdx] = { message: 'Units consumed is 0 — verify this is intentional.' };
      }
    }
  });

  return Object.keys(errors).length > 0 ? errors : null;
};

/**
 * Validates the entire sheet of rows.
 */
export const validateSheet = (rows, headers, context = {}, skip = 0) => {
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
    const actualRowIndex = idx + skip + 1; // absolute 0-based index in previewData (skipped rows offset applied)
    const rowErrors = validateRow(row, headers, fullContext) || {};
    
    // Smart Formula Autofill Detection:
    // If a cell is empty or a hardcoded value, but neighboring rows in the same column have formulas, suggest an adjusted formula.
    headers.forEach((header, colIdx) => {
      const headerLower = (header || '').toLowerCase().trim();
      const isCore = 
        headerLower.includes('date') ||
        headerLower.includes('plate') ||
        headerLower.includes('vehicle') ||
        headerLower.includes('soc') ||
        headerLower.includes('units') ||
        headerLower.includes('battery');
        
      if (!isCore) return;

      const cellVal = row[colIdx];
      const strVal = String(cellVal || '').trim();
      const isFormula = strVal.startsWith('=');
      
      if (!isFormula) {
        let templateFormula = null;
        let neighborIdx = -1;

        // Search up to NEIGHBOR_SCAN_RADIUS rows in both directions to find the nearest formula.
        // This ensures consecutive blocks of hardcoded/missing values all receive a suggestedValue,
        // not just the single row immediately adjacent to a formula row.
        const NEIGHBOR_SCAN_RADIUS = 10;

        // 1. Scan upward first (prefer the row above as the reference anchor)
        for (let offset = 1; offset <= NEIGHBOR_SCAN_RADIUS && idx - offset >= 0; offset++) {
          const candidateVal = rows[idx - offset][colIdx];
          if (typeof candidateVal === 'string' && candidateVal.startsWith('=')) {
            templateFormula = candidateVal;
            neighborIdx = idx - offset;
            break;
          }
        }

        // 2. If no formula found above, scan downward
        if (!templateFormula) {
          for (let offset = 1; offset <= NEIGHBOR_SCAN_RADIUS && idx + offset < rows.length; offset++) {
            const candidateVal = rows[idx + offset][colIdx];
            if (typeof candidateVal === 'string' && candidateVal.startsWith('=')) {
              templateFormula = candidateVal;
              neighborIdx = idx + offset;
              break;
            }
          }
        }
        
        if (templateFormula) {
          // Count formulas in this column to see if it is primarily formula-driven
          let formulaCount = 0;
          let validRows = 0;
          rows.forEach(r => {
            const v = String(r[colIdx] || '').trim();
            if (v) {
              validRows++;
              if (v.startsWith('=')) formulaCount++;
            }
          });
          
          const isColumnPrimarilyFormulas = (formulaCount / (validRows || 1)) >= 0.5;
          
          if (isColumnPrimarilyFormulas) {
            // Google Sheets row numbers: header is row 1, data starts at index 0 (row 2).
            // Offset neighborRowNumber and currentRowNumber by the skip parameter.
            // The delta between neighborRowNumber and currentRowNumber correctly adjusts
            // all row references in the template formula regardless of scan distance.
            const neighborRowNumber = neighborIdx + skip + 2;
            const currentRowNumber = idx + skip + 2;
            
            // Regex to shift ALL row references in the formula (e.g. A4 → A7)
            const refRegex = new RegExp(`([A-Z]+)${neighborRowNumber}\\b`, 'g');
            const suggestedFormula = templateFormula.replace(refRegex, `$1${currentRowNumber}`);
            
            if (strVal !== suggestedFormula) {
              rowErrors[colIdx] = {
                message: cellVal
                  ? `Hardcoded override in formula column. Click Autofill to restore formula.`
                  : `Missing formula. Click Autofill to generate.`,
                isFormulaSuggestion: true,
                suggestedValue: suggestedFormula
              };
            }
          }
        }
      }
    });

    if (Object.keys(rowErrors).length > 0) {
      errors[actualRowIndex] = rowErrors;
    }
  });
  
  return errors;
};
