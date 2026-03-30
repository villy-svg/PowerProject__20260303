import React, { useState } from 'react';
import './TaskActionModals.css'; // Reusing standard modal styles

const RejectionModal = ({ isOpen, onClose, onSubmit, task }) => {
  const [reason, setReason] = useState('');

  if (!isOpen || !task) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onSubmit(reason.trim());
    setReason('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Reject Submission for: {task.text}</h2>
        </div>

        <form onSubmit={handleSubmit} className="task-form">
          <div className="form-group" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <label>Rejection Reason *</label>
            <p className="field-hint">Please provide specific feedback for the field worker on what needs to be fixed or redone.</p>
            <textarea
              className="halo-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., The photo of the equipment is blurry. Please retake it."
              required
              rows={4}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '24px' }}>
            <button type="button" className="halo-button cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="halo-button reject-btn" disabled={!reason.trim()}>
              Reject & Require Rework
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectionModal;
