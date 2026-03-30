import React, { useState, useRef, useCallback } from 'react';
import TaskModal from './TaskModal';
import { submitProofOfWork } from '../services/tasks/submissionService';
import './SubmissionModal.css';

/**
 * SubmissionModal
 * Proof of Work submission modal for Field Contributors.
 * Allows adding a comment and uploading compressed photos/documents.
 *
 * Props:
 * - isOpen (bool): Controls modal visibility
 * - onClose (fn): Callback to close the modal
 * - task (object): The task being submitted against ({ id, text })
 * - user (object): Current user ({ id })
 * - onSubmitSuccess (fn): Optional callback after successful submission
 */
const SubmissionModal = ({ isOpen, onClose, task, user, onSubmitSuccess }) => {
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // ─── File Handlers ──────────────────────────────────────────────────────
  const handleFiles = useCallback((newFiles) => {
    const fileArray = Array.from(newFiles);
    setFiles((prev) => [...prev, ...fileArray]);
  }, []);

  const removeFile = useCallback((index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileInputChange = useCallback((e) => {
    if (e.target.files?.length > 0) {
      handleFiles(e.target.files);
      e.target.value = ''; // Reset to allow re-selecting same file
    }
  }, [handleFiles]);

  // ─── Submit Handler ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!comment.trim() && files.length === 0) return;
    if (!task?.id || !user?.id) return;

    setSubmitting(true);
    const totalSteps = files.length + 1; // files + DB insert
    setProgress({ current: 0, total: totalSteps, label: 'Preparing...' });

    try {
      // Update progress as files are processed
      setProgress({ current: 0, total: totalSteps, label: `Compressing ${files.length} file(s)...` });

      const result = await submitProofOfWork({
        taskId: task.id,
        userId: user.id,
        comment: comment.trim(),
        files,
      });

      setProgress({ current: totalSteps, total: totalSteps, label: 'Done!' });

      // Reset state
      setComment('');
      setFiles([]);
      setSubmitting(false);
      setProgress({ current: 0, total: 0, label: '' });

      if (onSubmitSuccess) onSubmitSuccess(result);
      onClose();
    } catch (err) {
      console.error('Submission error:', err);
      alert(`Submission failed: ${err.message}`);
      setSubmitting(false);
      setProgress({ current: 0, total: 0, label: '' });
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────────────
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImageFile = (file) => file.type.startsWith('image/');

  const canSubmit = (comment.trim().length > 0 || files.length > 0) && !submitting;

  if (!isOpen) return null;

  return (
    <TaskModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Submit Proof of Work`}
      className="large-modal"
    >
      <div className="submission-modal-body">
        {/* Task Context */}
        {task && (
          <div style={{ marginBottom: '0.25rem' }}>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              opacity: 0.5,
            }}>
              Task
            </span>
            <p style={{
              margin: '4px 0 0',
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text-color)',
            }}>
              {task.text}
            </p>
          </div>
        )}

        {/* Comment Section */}
        <div>
          <label className="submission-section-label">Comment</label>
          <textarea
            className="submission-comment-area"
            placeholder="Describe what was done, observations, or issues encountered..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={submitting}
          />
        </div>

        {/* File Upload Zone */}
        <div>
          <label className="submission-section-label">Attachments</label>
          <div
            className={`submission-upload-zone ${dragActive ? 'drag-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
            <div className="upload-zone-icon">📷</div>
            <div className="upload-zone-text">
              <strong>Click to browse</strong> or drag and drop<br />
              Images auto-compressed to 300KB · Photos, PDFs, Docs
            </div>
          </div>
        </div>

        {/* File Preview Strip */}
        {files.length > 0 && (
          <div className="submission-file-list">
            {files.map((file, index) => (
              <div className="submission-file-chip" key={`${file.name}-${index}`}>
                {isImageFile(file) ? (
                  <img
                    className="file-chip-thumbnail"
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                  />
                ) : (
                  <div className="file-chip-icon">📄</div>
                )}
                <span className="file-chip-name">{file.name}</span>
                <span className="file-chip-size">{formatFileSize(file.size)}</span>
                <button
                  className="file-chip-remove"
                  onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                  disabled={submitting}
                  title="Remove file"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Progress Indicator */}
        {submitting && progress.total > 0 && (
          <div className="submission-progress">
            <div className="submission-progress-bar">
              <div
                className="submission-progress-fill"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <span className="submission-progress-text">{progress.label}</span>
          </div>
        )}

        {/* Actions */}
        <div className="submission-actions">
          <button
            className="submission-cancel-btn"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="halo-button submission-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? 'Uploading...' : '📤 Submit Proof'}
          </button>
        </div>
      </div>
    </TaskModal>
  );
};

export default SubmissionModal;
