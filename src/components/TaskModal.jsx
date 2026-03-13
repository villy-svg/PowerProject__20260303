import React from 'react';
import './TaskModal.css';

/**
 * TaskModal
 * A generic modal for task creation/editing.
 * Accepts a 'Form' component to render vertical-specific fields.
 */
const TaskModal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="task-modal-header">
          <h2>{title}</h2>
          <button className="close-modal-btn" onClick={onClose}>&times;</button>
        </header>
        <div className="task-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
