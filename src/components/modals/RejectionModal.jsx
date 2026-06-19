import React, { useState } from 'react';
import TaskModal from './TaskModal';
import './RejectionModal.css';

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
    <TaskModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Reject Submission: ${task.text}`}
      className="medium-modal"
    >
      <form onSubmit={handleSubmit} className="rejection-form">
        <div className="form-group">
          <label>Rejection Reason *</label>
          <p className="rejection-feedback-hint">
            Please provide specific feedback for the field worker on what needs to be fixed or redone.
          </p>
          <textarea
            className="rejection-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., The photo of the equipment is blurry. Please retake it."
            required
            rows={4}
          />
        </div>

        <div className="rejection-actions">
          <button 
            type="button" 
            className="halo-button cancel-btn" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="halo-button confirm-reject-btn" 
            disabled={!reason.trim()}
          >
            Reject & Require Rework
          </button>
        </div>
      </form>
    </TaskModal>
  );
};

export default RejectionModal;
