import React from 'react';
import { STAGE_LIST } from '../constants/stages';
import { 
  IconArrowLeft, 
  IconArrowRight, 
  IconPromote,
  IconTrash,
  IconX,
  IconChevronDown,
} from './Icons';

/**
 * BulkActionBar Component
 * Floating overlay for performing actions on multiple selected tasks.
 * Reacts to scroll direction (hides on down-scroll) via isTrayVisible prop.
 */
const BulkActionBar = ({
  selectedCount,
  isTrayVisible,
  canUpdate,
  canDelete,
  sameStage,
  commonStageId,
  onAction,
  onClear
}) => {
  return (
    <div className={`bulk-action-bar ${selectedCount === 0 ? 'bulk-hidden' : ''} ${!isTrayVisible ? 'tray-hidden' : ''}`}>
      <div className="bulk-info">
        <span className="selection-count">{selectedCount} Selected</span>
      </div>

      <div className="bulk-actions">
        {canUpdate && sameStage && commonStageId !== STAGE_LIST[0].id && (
          <button
            className="bulk-btn"
            onClick={() => onAction('backward')}
            title="Move Backward"
          >
            <IconArrowLeft size={18} strokeWidth={2} />
            <span className="bulk-btn-text">Prev</span>
          </button>
        )}

        {canUpdate && sameStage && commonStageId !== STAGE_LIST[STAGE_LIST.length - 1].id && (
          <button
            className="bulk-btn"
            onClick={() => onAction('forward')}
            title="Move Forward"
          >
            <span className="bulk-btn-text">Next</span>
            <IconArrowRight size={18} strokeWidth={2} />
          </button>
        )}

        {canUpdate && commonStageId !== 'DEPRIORITIZED' && (
          <button
            className="bulk-btn deprio"
            onClick={() => onAction('deprio')}
            title="Defer Selection"
          >
            <IconChevronDown size={18} strokeWidth={2} />
            <span className="bulk-btn-text">Defer</span>
          </button>
        )}

        {canUpdate && commonStageId === 'DEPRIORITIZED' && (
          <button
            className="bulk-btn restore"
            onClick={() => onAction('restore')}
            title="Restore to Pending"
          >
            <IconPromote size={18} strokeWidth={2} /> 
            <span className="bulk-btn-text">Restore</span>
          </button>
        )}

        {canDelete && (
          <button
            className="bulk-btn delete"
            onClick={() => onAction('delete')}
            title="Delete Permanently"
          >
            <IconTrash size={18} strokeWidth={2} /> 
            <span className="bulk-btn-text">Delete</span>
          </button>
        )}

        <button
          className="bulk-btn cancel"
          onClick={onClear}
          title="Cancel Selection"
        >
          <IconX size={18} strokeWidth={2} />
          <span className="bulk-btn-text">Cancel</span>
        </button>
      </div>
    </div>
  );
};

export default BulkActionBar;
