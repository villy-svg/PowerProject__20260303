import React, { useState } from 'react';
import { evaluateFormula } from '../utils/validationRules';
import './DataGrid.css';

const DataGrid = ({
  headers,
  renderRows,
  validationErrors,
  editedCells,
  isEditableTab,
  onCellEdit,
  onAutofixColumn
}) => {
  // Track currently focused input cell coordinates: { rowIndex, colIdx }
  const [focusedCell, setFocusedCell] = useState(null);

  return (
    <div className="data-grid__wrapper">
      <table className="data-grid__table">
        <thead>
          <tr className="data-grid__thead">
            <th className="data-grid__th-num">Row</th>
            {headers.map((cell, idx) => {
              const hasFixableError = Object.values(validationErrors).some(rowErrs => rowErrs[idx]?.suggestedValue !== undefined);
              return (
                <th key={idx} className="data-grid__th">
                  <div className="u-flex-center-gap">
                    <span>{cell || `Col ${idx + 1}`}</span>
                    {hasFixableError && isEditableTab && (
                      <button
                        type="button"
                        onClick={() => onAutofixColumn(idx)}
                        title="Autofix all formatting anomalies in this column"
                        className="data-grid__autofix-btn"
                      >
                        ⚡ Fix Column
                      </button>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {renderRows.map(({ originalIndex, cells }) => {
            const rowErrors = validationErrors[originalIndex] || {};
            const rowEdits = editedCells[originalIndex] || {};

            // Reconstruct the full current row values (original + unsaved edits) for formula evaluation
            const currentRowValues = cells.map((cellVal, cIdx) => 
              rowEdits[cIdx] !== undefined ? rowEdits[cIdx] : (cellVal !== undefined ? cellVal : '')
            );

            return (
              <tr 
                key={originalIndex} 
                className="data-grid__tr"
                style={{ 
                  background: originalIndex % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                }}
              >
                {/* Row number */}
                <td className="data-grid__td-num">
                  {originalIndex + 1}
                </td>

                {/* Render cells */}
                {headers.map((_, colIdx) => {
                  const cellError = rowErrors[colIdx];
                  const isEdited = rowEdits[colIdx] !== undefined;
                  const rawValue = isEdited ? rowEdits[colIdx] : (cells[colIdx] !== undefined ? cells[colIdx] : '');

                  const isFocused = focusedCell && focusedCell.rowIndex === originalIndex && focusedCell.colIdx === colIdx;

                  // Determine display value: if not focused and starts with '=', evaluate the formula client-side
                  let displayValue = (!isFocused && typeof rawValue === 'string' && rawValue.startsWith('='))
                    ? evaluateFormula(rawValue, currentRowValues, headers)
                    : rawValue;

                  // Auto-format Excel serialized date numbers (e.g. 46174) in date columns
                  const colHeader = (headers[colIdx] || '').toLowerCase().trim();
                  if (colHeader.includes('date') && displayValue != null && /^\d+$/.test(String(displayValue).trim())) {
                    const numVal = parseInt(String(displayValue).trim(), 10);
                    if (numVal > 30000 && numVal < 70000) {
                      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                      const dateObj = new Date(excelEpoch.getTime() + numVal * 24 * 60 * 60 * 1000);
                      if (!isNaN(dateObj.getTime())) {
                        displayValue = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
                      }
                    }
                  }

                  return (
                    <td 
                      key={colIdx} 
                      className="data-grid__td"
                    >
                      {isEditableTab ? (
                        <div className="data-grid__cell-wrapper">
                          <input
                            type="text"
                            value={displayValue}
                            onChange={(e) => onCellEdit(originalIndex, colIdx, e.target.value)}
                            onFocus={() => setFocusedCell({ rowIndex: originalIndex, colIdx })}
                            onBlur={() => setFocusedCell(null)}
                            className="data-grid__input"
                            style={{
                              background: cellError ? 'rgba(239, 68, 68, 0.05)' : isEdited ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                              paddingRight: cellError?.isDateSwap ? '65px' : 
                                           ((cellError?.isDateFormatAnomaly || cellError?.isSoCFormatAnomaly) ? '75px' : 
                                           (cellError?.isPlateFormatAnomaly ? '70px' : 
                                           (cellError?.isFormulaSuggestion ? '80px' : '10px')))
                            }}
                            title={cellError?.message || undefined}
                          />
                          
                          {/* Intelligent Month-Day Swap Autocorrect button */}
                          {cellError?.isDateSwap && (
                            <button
                              type="button"
                              onClick={() => onCellEdit(originalIndex, colIdx, cellError.suggestedValue)}
                              title={`Click to autocorrect swap to ${cellError.suggestedValue}`}
                              className="data-grid__cell-action-btn"
                            >
                              💡 Swap
                            </button>
                          )}

                          {/* Date & SoC Format Standardizer button */}
                          {(cellError?.isDateFormatAnomaly || cellError?.isSoCFormatAnomaly) && (
                            <button
                              type="button"
                              onClick={() => onCellEdit(originalIndex, colIdx, cellError.suggestedValue)}
                              title={cellError.isSoCFormatAnomaly 
                                ? `Click to format SoC to ${cellError.suggestedValue}` 
                                : `Click to standardize date format to ${cellError.suggestedValue}`}
                              className="data-grid__cell-action-btn"
                            >
                              💡 Format
                            </button>
                          )}

                          {/* EV Plate Cleaner button */}
                          {cellError?.isPlateFormatAnomaly && (
                            <button
                              type="button"
                              onClick={() => onCellEdit(originalIndex, colIdx, cellError.suggestedValue)}
                              title={`Click to clean plate format to ${cellError.suggestedValue}`}
                              className="data-grid__cell-action-btn"
                            >
                              💡 Clean
                            </button>
                          )}

                          {/* Smart Formula Autofill button */}
                          {cellError?.isFormulaSuggestion && (
                            <button
                              type="button"
                              onClick={() => onCellEdit(originalIndex, colIdx, cellError.suggestedValue)}
                              title={`Click to autofill formula: ${cellError.suggestedValue}`}
                              className="data-grid__cell-action-btn"
                            >
                              ⚡ Autofill
                            </button>
                          )}

                          {cellError && (
                            <div className="data-grid__cell-error-label">
                              {cellError.message}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="data-grid__cell-display-value">
                          {displayValue}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default DataGrid;
