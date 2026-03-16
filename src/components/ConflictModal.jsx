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
  entityName = "Records"
}) => {
  const [selectedIndices, setSelectedIndices] = useState(new Set());

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
    <TaskModal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="conflict-modal-body">
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
                    {renderConflictTile(c)}
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
                  <button className="halo-button pick-btn" onClick={() => onResolve([c])}>
                    Keep This Record
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </TaskModal>
  );
};

export default ConflictModal;
