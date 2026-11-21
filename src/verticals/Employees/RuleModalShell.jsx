import React from 'react';
import StatusMsg from '../../components/ui/StatusMsg';
import '../../styles/ManagementForms.css';

/**
 * RuleModalShell
 *
 * Shared modular modal shell for Rule, Category, and Sub-Category forms.
 * Absorbs the common overlay, header, scrollable body, status banner, and
 * footer chrome so each form modal only defines its domain fields.
 */
const RuleModalShell = ({
  isOpen,
  onClose,
  title,
  onSubmit,
  saving = false,
  submitLabel = 'Save',
  status = { type: '', text: '' },
  modalClassName = '',
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content hub-modal ${modalClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="close-modal"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </header>

        <form onSubmit={onSubmit} className="vertical-task-form">
          <div className="modal-content-area">
            {children}
            <StatusMsg msg={status} />
          </div>

          <div className="modal-footer">
            <button type="button" className="halo-button cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="halo-button save-btn" disabled={saving}>
              {saving ? 'Saving...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RuleModalShell;
