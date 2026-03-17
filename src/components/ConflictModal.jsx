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
  onKeepBoth, // New Callback for Soft Matches
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
    <TaskModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={reviewIdx !== null ? `Detailed Comparison: ${entityName}` : title}
      className={reviewIdx !== null ? 'xl-modal' : 'large-modal'}
    >
      <div className="conflict-modal-body">
        {reviewIdx !== null ? (
          <div className="conflict-review-view">
            <div className="review-header">
              <button className="back-to-list" onClick={() => setReviewIdx(null)}>
                <span>←</span> Back to Conflict List
              </button>
              <div className="review-status-indicator">
                {selectedIndices.has(reviewIdx) ? (
                  <span className="status-badge selected">Selected for Update</span>
                ) : (
                  <span className="status-badge pending">Pending Review</span>
                )}
              </div>
            </div>

            <div className="comparison-container">
              <div className="comparison-legend">
                <p>New CSV Data (Left) vs Existing Database Record (Right)</p>
              </div>
              
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th style={{ width: '20%' }}>Field</th>
                    <th style={{ width: '40%' }}>New Data (Incoming)</th>
                    <th style={{ width: '40%' }}>Current Record (In System)</th>
                  </tr>
                </thead>
                <tbody>
                  {compareFields.map(field => {
                    const csvVal = conflicts[reviewIdx].csvRow[field.key] || 'N/A';
                    const dbVal = conflicts[reviewIdx].existingRecord[field.key] || 'N/A';
                    const hasDiff = String(csvVal).toLowerCase() !== String(dbVal).toLowerCase();

                    return (
                      <tr key={field.key} className={hasDiff ? 'has-difference' : ''}>
                        <td className="field-label">{field.label}</td>
                        <td className="val-new">{csvVal}</td>
                        <td className="val-old">{dbVal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="review-actions">
              <button 
                className={`halo-button ${selectedIndices.has(reviewIdx) ? 'delete-btn' : 'save-btn'}`}
                onClick={() => { toggleSelection(reviewIdx); setReviewIdx(null); }}
              >
                {selectedIndices.has(reviewIdx) ? 'Unselect & Close' : 'Select to Overwrite & Close'}
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
                        <div className="conflict-tile-actions" style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          {compareFields.length > 0 && (
                            <button 
                              className="review-btn" 
                              onClick={(e) => { e.stopPropagation(); setReviewIdx(idx); }}
                              style={{ flex: 1 }}
                            >
                              Review
                            </button>
                          )}
                          {c.matchMode === 'soft' && onKeepBoth && (
                            <button 
                              className="halo-button save-btn" 
                              onClick={(e) => { e.stopPropagation(); onKeepBoth(c); }}
                              style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--brand-green)' }}
                            >
                              Keep Both
                            </button>
                          )}
                        </div>
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
