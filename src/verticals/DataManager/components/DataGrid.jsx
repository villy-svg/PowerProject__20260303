import React from 'react';

const DataGrid = ({
  headers,
  renderRows,
  validationErrors,
  editedCells,
  isEditableTab,
  onCellEdit
}) => {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '500px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '2px solid var(--border-color)' }}>
            <th style={{ padding: '12px 16px', color: 'var(--brand-mint)', fontWeight: 'bold', width: '50px' }}>Row</th>
            {headers.map((cell, idx) => (
              <th key={idx} style={{ padding: '12px 16px', color: 'var(--brand-mint)', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                {cell || `Col ${idx + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {renderRows.map(({ originalIndex, cells }) => {
            const rowErrors = validationErrors[originalIndex] || {};
            const rowEdits = editedCells[originalIndex] || {};

            return (
              <tr 
                key={originalIndex} 
                style={{ 
                  borderBottom: '1px solid var(--border-color)', 
                  background: originalIndex % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  transition: 'background 0.2s'
                }}
              >
                {/* Row number */}
                <td style={{ padding: '12px 16px', color: 'var(--text-color)', opacity: 0.5, fontWeight: 'bold' }}>
                  {originalIndex + 1}
                </td>

                {/* Render cells */}
                {headers.map((_, colIdx) => {
                  const cellError = rowErrors[colIdx];
                  const isEdited = rowEdits[colIdx] !== undefined;
                  const cellValue = isEdited ? rowEdits[colIdx] : (cells[colIdx] !== undefined ? cells[colIdx] : '');

                  return (
                    <td 
                      key={colIdx} 
                      style={{ 
                        padding: '6px 8px', 
                        color: 'var(--text-color)', 
                        whiteSpace: 'nowrap',
                        position: 'relative'
                      }}
                    >
                      {isEditableTab ? (
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            value={cellValue}
                            onChange={(e) => onCellEdit(originalIndex, colIdx, e.target.value)}
                            style={{
                              width: '100%',
                              background: cellError ? 'rgba(239, 68, 68, 0.05)' : isEdited ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                              color: 'var(--text-color)',
                              border: `1px solid ${cellError ? '#f87171' : isEdited ? 'var(--brand-mint)' : 'transparent'}`,
                              borderRadius: '4px',
                              padding: '6px 10px',
                              fontSize: '13px',
                              outline: 'none',
                              transition: 'all 0.2s'
                            }}
                            title={cellError || undefined}
                          />
                          {cellError && (
                            <div style={{
                              position: 'absolute',
                              bottom: '-12px',
                              left: '6px',
                              color: '#f87171',
                              fontSize: '9px',
                              whiteSpace: 'nowrap',
                              zIndex: 10
                            }}>
                              {cellError}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ padding: '6px 10px', display: 'inline-block', opacity: 0.85 }}>
                          {cellValue}
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
