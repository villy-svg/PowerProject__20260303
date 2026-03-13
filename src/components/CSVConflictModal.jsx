import React, { useState } from 'react';
import './CSVConflictModal.css';

/**
 * CSVConflictModal
 * 
 * A generic modal for resolving CSV import conflicts (duplicates).
 * 
 * Props:
 *   conflicts           {Array}    - List of conflict objects
 *   onResolve           {Function} - Called with (selectedRowsToUpdate)
 *   onCancel            {Function} - Close modal without doing anything
 *   renderConflictTile  {Function} - (conflict, isSelected) => JSX
 *   entityName          {string}   - Name of the entity being imported (e.g. "Hubs")
 */
const CSVConflictModal = ({ 
  conflicts, 
  onResolve, 
  onCancel, 
  renderConflictTile,
  entityName = "Entries"
}) => {
  const [selectedIndices, setSelectedIndices] = useState(new Set());

  const toggleSelection = (index) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedIndices(next);
  };

  const handleApplySelection = () => {
    const selectedRows = conflicts
      .filter((_, i) => selectedIndices.has(i))
      .map(c => c.csvRow);
    onResolve(selectedRows);
  };

  const handleReplaceAll = () => {
    const allRows = conflicts.map(c => c.csvRow);
    onResolve(allRows);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content hub-modal conflict-modal">
        <header className="modal-header">
          <h2>Duplicate {entityName} Detected</h2>
          <button className="close-modal" onClick={onCancel}>&times;</button>
        </header>

        <div className="conflict-warning">
          <h3>⚠️ Data Conflicts Found</h3>
          <p>We found <strong>{conflicts.length}</strong> {entityName.toLowerCase()} in your CSV that already exist in the database. How would you like to proceed?</p>
        </div>

        <div className="conflict-options">
          <div className="option-box">
            <h4>1. Replace All Existing</h4>
            <p>Overwrite all {conflicts.length} duplicates with the new information from your CSV.</p>
            <button className="halo-button save-btn" style={{ marginTop: '12px' }} onClick={handleReplaceAll}>
              Overwrite All Records
            </button>
          </div>

          <div className="option-box">
            <h4>2. Select replacements in tiles</h4>
            <p>Choose exactly which records to overwrite and which to leave as they are.</p>
            
            <div className="selection-tiles-container">
              {conflicts.map((conflict, idx) => (
                <div 
                  key={idx} 
                  className={`conflict-tile ${selectedIndices.has(idx) ? 'selected' : ''}`}
                  onClick={() => toggleSelection(idx)}
                >
                  <input 
                    type="checkbox" 
                    className="tile-checkbox" 
                    checked={selectedIndices.has(idx)}
                    readOnly
                  />
                  {renderConflictTile(conflict, selectedIndices.has(idx))}
                </div>
              ))}
            </div>

            <div className="modal-action-bar">
              <button 
                className="halo-button save-btn" 
                disabled={selectedIndices.size === 0}
                onClick={handleApplySelection}
              >
                Update Selected ({selectedIndices.size})
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="halo-button cancel-btn" onClick={onCancel}>Cancel Full Import</button>
        </div>
      </div>
    </div>
  );
};

export default CSVConflictModal;
