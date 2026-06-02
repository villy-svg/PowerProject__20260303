/**
 * validationRules.js
 * Decoupled, pure validation engine for vehicle transaction spreadsheet rows.
 */

export const validateRow = (row, headers) => {
  const errors = {};
  headers.forEach((header, colIdx) => {
    const value = row[colIdx];
    const headerLower = (header || '').toLowerCase().trim();

    // Skip checking empty or unrecognized headers
    if (!headerLower) return;

    // Rule: Required Columns
    if (value === undefined || value === null || String(value).trim() === '') {
      errors[colIdx] = `${header} cannot be empty.`;
      return;
    }

    const strVal = String(value).trim();

    // Rule: Date validation
    if (headerLower.includes('date')) {
      const date = new Date(strVal);
      if (isNaN(date.getTime())) {
        errors[colIdx] = 'Invalid Date format (use YYYY-MM-DD).';
      }
    }

    // Rule: SoC Range [0, 100]
    if (headerLower.includes('soc')) {
      const num = parseFloat(strVal);
      if (isNaN(num) || num < 0 || num > 100) {
        errors[colIdx] = 'SoC must be between 0 and 100.';
      }
    }

    // Rule: Positive Numbers for consumed units & battery size
    if (headerLower.includes('units consumed') || headerLower.includes('battery size')) {
      const num = parseFloat(strVal);
      if (isNaN(num) || num < 0) {
        errors[colIdx] = 'Must be positive.';
      }
    }
  });

  return Object.keys(errors).length > 0 ? errors : null;
};

export const validateSheet = (rows, headers) => {
  const errors = {};
  rows.forEach((row, idx) => {
    const actualRowIndex = idx + 1; // 1-indexed to match data rows (skipping header)
    const rowErrors = validateRow(row, headers);
    if (rowErrors) {
      errors[actualRowIndex] = rowErrors;
    }
  });
  return errors;
};
