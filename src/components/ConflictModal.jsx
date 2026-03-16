import React, { useState } from 'react';
import TaskModal from './TaskModal';
import './ConflictModal.css';

/**
 * ConflictModal (Master)
 * 
 * A unified modal for resolving data conflicts during imports, merges, or manual entry.
 * 
 * Props:
 *   isOpen              {boolean}  - Modal open state
 *   onClose             {function} - Close without action
 *   title               {string}   - Header title
 *   description         {string}   - Instruction text
 *   conflicts           {Array}    - List of conflict clusters [{ master, slaves: [] }]
 *   strategy            {string}   - 'PICK_ONE' | 'REPLACE_ALL_OR_SELECT'
 *   onResolve           {function} - (resolutionSet) => void
 *   renderConflictTile  {function} - (item, isSelected) => JSX
 *   entityName          {string}   - "Tasks", "Employees", etc.
 */
const ConflictModal = ({
  isOpen,
  onClose,
  title = "Resolve Conflicts",
  description,
  conflicts = [],
  strategy = 'REPLACE_ALL_OR_SELECT',
  onResolve,
  renderConflictTile,
  entityName = "Records",
  compareFields = [] // [{ key, label }]
}) => {
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [reviewIdx, setReviewIdx] = useState(null);

  const toggleSelection = (idx) => {
    const next = new Set(selectedIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedIndices(next);
  };

  const handleApply = () => {
    const selected = conflicts
      .filter((_, i) => selectedIndices.has(i));
    onResolve(selected);
  };

  const handleAll = () => {
    onResolve(conflicts);
  };

  return (
    <TaskModal isOpen={isOpen} onClose={onClose} title={reviewIdx !== null ? `Review Changes: ${entityName}` : title}>
      <div className="conflict-modal-body">
        {reviewIdx !== null ? (
          <div className="conflict-review-view">
            <button className="back-to-list" onClick={() => setReviewIdx(null)}>← Back to List</button>
            <p className="review-intro">Comparing CSV data (left) with existing Database record (right).</p>
            
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>New (CSV)</th>
                  <th>Existing (DB)</th>
                </tr>
              </thead>
              <tbody>
                {compareFields.map(field => {
                  const csvVal = conflicts[reviewIdx].csvRow[field.key] || 'N/A';
                  const dbVal = conflicts[reviewIdx].existingRecord[field.key] || 'N/A';
                  const hasDiff = String(csvVal).toLowerCase() !== String(dbVal).toLowerCase();

                  return (
                    <tr key={field.key} className={hasDiff ? 'has-difference' : ''}>
                      <td><strong>{field.label}</strong></td>
                      <td className="val-new">{csvVal}</td>
                      <td className="val-old">{dbVal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="review-actions">
              <button 
                className={`halo-button ${selectedIndices.has(reviewIdx) ? 'delete-btn' : 'save-btn'}`}
                onClick={() => { toggleSelection(reviewIdx); setReviewIdx(null); }}
              >
                {selectedIndices.has(reviewIdx) ? 'Unselect for Update' : 'Select for Update'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {description && <p className="conflict-intro">{description}</p>}
            
            {strategy === 'REPLACE_ALL_OR_SELECT' ? (
              <div className="conflict-flow-dual">
                <div className="option-box primary-overwrite">
                  <h4>1. Bulk Resolve</h4>
                  <p>Overwrite all {conflicts.length} existing {entityName.toLowerCase()} with the new information.</p>
                  <button className="halo-button save-btn" onClick={handleAll}>
                    Overwrite All
                  </button>
                </div>

                <div className="option-box secondary-select">
                  <h4>2. Selective Resolve</h4>
                  <p>Pick exactly which records to update.</p>
                  <div className="conflict-tiles-grid">
                    {conflicts.map((c, idx) => (
                      <div 
                        key={idx} 
                        className={`conflict-tile ${selectedIndices.has(idx) ? 'selected' : ''}`}
                        onClick={() => toggleSelection(idx)}
                      >
                        <input type="checkbox" checked={selectedIndices.has(idx)} readOnly />
                        <div className="tile-main">
                          {renderConflictTile(c)}
                        </div>
                        {compareFields.length > 0 && (
                          <button 
                            className="review-btn" 
                            onClick={(e) => { e.stopPropagation(); setReviewIdx(idx); }}
                          >
                            Review
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button 
                    className="halo-button save-btn" 
                    disabled={selectedIndices.size === 0}
                    onClick={handleApply}
                  >
                    Update Selected ({selectedIndices.size})
                  </button>
                </div>
              </div>
            ) : (
              <div className="conflict-flow-pick">
                <div className="conflict-tiles-grid single-pick">
                  {conflicts.map((c, idx) => (
                    <div key={idx} className="conflict-pick-card">
                      {renderConflictTile(c)}
                      {compareFields.length > 0 && (
                        <button 
                          className="review-btn-inline" 
                          onClick={() => setReviewIdx(idx)}
                        >
                          Review Changes
                        </button>
                      )}
                      <button className="halo-button pick-btn" onClick={() => onResolve([c])}>
                        Keep This Record
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </TaskModal>
  );
};

export default ConflictModal;
