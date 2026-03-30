import React, { useState } from 'react';
import TaskModal from './TaskModal';

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
      <form onSubmit={handleSubmit} className="task-form">
        <div className="form-group" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--brand-mint)' }}>
            Rejection Reason *
          </label>
          <p className="field-hint" style={{ fontSize: '0.85rem', opacity: 0.7, margin: '4px 0 12px' }}>
            Please provide specific feedback for the field worker on what needs to be fixed or redone.
          </p>
          <textarea
            className="halo-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., The photo of the equipment is blurry. Please retake it."
            required
            rows={4}
            style={{ 
              width: '100%', 
              resize: 'vertical',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '12px',
              color: 'var(--text-color)'
            }}
          />
        </div>

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <button type="button" className="halo-button cancel-btn" onClick={onClose} style={{ background: 'transparent' }}>
            Cancel
          </button>
          <button 
            type="submit" 
            className="halo-button save-btn" 
            disabled={!reason.trim()}
            style={{ background: 'var(--brand-red, #ef4444)' }}
          >
            Reject & Require Rework
          </button>
        </div>
      </form>
    </TaskModal>
  );
};

export default RejectionModal;
