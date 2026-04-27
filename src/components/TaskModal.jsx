import React from 'react';
import ReactDOM from 'react-dom';
import './TaskModal.css';

/**
 * TaskModal
 * A generic modal for task creation/editing.
 * Rendered via a React Portal at document.body to prevent nested event conflicts.
 */
const TaskModal = ({ isOpen, onClose, title, children, className = '' }) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className={`task-modal-overlay ${className}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="task-modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="task-modal-header">
          <h2>{title}</h2>
          <button 
            id="close-task-modal"
            type="button"
            className="close-modal-btn" 
            onClick={onClose}
            aria-label="Close Modal"
          >
            &times;
          </button>
        </header>
        <div className="task-modal-body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TaskModal;
