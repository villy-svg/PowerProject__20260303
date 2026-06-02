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
      const date = new Date(strVal);
      if (isNaN(date.getTime())) {
        errors[colIdx] = { message: 'Invalid Date format (use MM/DD/YYYY).' };
      } else {
        const strictDateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
        const isStrict = strictDateRegex.test(strVal);

        if (!isStrict) {
          const pad = (num) => String(num).padStart(2, '0');
          const standardized = `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`;
          errors[colIdx] = {
            message: `Non-standard date format. Click to format to MM/DD/YYYY.`,
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
    const rowErrors = validateRow(row, headers, fullContext) || {};
    
    // Smart Formula Autofill Detection:
    // If a cell is empty or a hardcoded value, but neighboring rows in the same column have formulas, suggest an adjusted formula.
    headers.forEach((_, colIdx) => {
      const cellVal = row[colIdx];
      const strVal = String(cellVal || '').trim();
      const isFormula = strVal.startsWith('=');
      
      if (!isFormula) {
        let templateFormula = null;
        let neighborIdx = -1;
        
        // 1. Check row immediately above
        if (idx > 0) {
          const aboveVal = rows[idx - 1][colIdx];
          if (typeof aboveVal === 'string' && aboveVal.startsWith('=')) {
            templateFormula = aboveVal;
            neighborIdx = idx - 1;
          }
        }
        
        // 2. Check row immediately below
        if (!templateFormula && idx < rows.length - 1) {
          const belowVal = rows[idx + 1][colIdx];
          if (typeof belowVal === 'string' && belowVal.startsWith('=')) {
            templateFormula = belowVal;
            neighborIdx = idx + 1;
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
            // Google Sheets row numbers: header is row 1, data starts at index 0 (row 2)
            const neighborRowNumber = neighborIdx + 2;
            const currentRowNumber = idx + 2;
            
            // Regex to shift row references (e.g. A4 -> A5)
            const refRegex = new RegExp(`([A-Z]+)${neighborRowNumber}\\b`, 'g');
            const suggestedFormula = templateFormula.replace(refRegex, `$1${currentRowNumber}`);
            
            if (strVal !== suggestedFormula) {
              rowErrors[colIdx] = {
                message: cellVal ? `Hardcoded override in formula column. Click Autofill to restore formula.` : `Missing formula. Click Autofill to generate.`,
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
