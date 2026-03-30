import React, { useState, useRef, useCallback } from 'react';
import TaskModal from './TaskModal';
import { submitProofOfWork } from '../services/tasks/submissionService';
import './SubmissionModal.css';

/**
 * SubmissionModal
 * Proof of Work submission modal for Field Contributors.
 * Two actions: "Upload Only" (save proof, stay in stage) and "Submit for Review" (save + move to REVIEW).
 * Read-only when task is in REVIEW or COMPLETED (attachments locked).
 *
 * Props:
 * - isOpen (bool): Controls modal visibility
 * - onClose (fn): Callback to close the modal
 * - task (object): The task being submitted against ({ id, text, stageId })
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

  // Task is locked if it's already in REVIEW or COMPLETED
  const isLocked = task?.stageId === 'REVIEW' || task?.stageId === 'COMPLETED';

  // ─── File Handlers ──────────────────────────────────────────────────────
  const handleFiles = useCallback((newFiles) => {
    if (isLocked) return;
    const fileArray = Array.from(newFiles);
    setFiles((prev) => [...prev, ...fileArray]);
  }, [isLocked]);

  const removeFile = useCallback((index) => {
    if (isLocked) return;
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, [isLocked]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLocked) setDragActive(true);
  }, [isLocked]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!isLocked && e.dataTransfer.files?.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles, isLocked]);

  const handleFileInputChange = useCallback((e) => {
    if (e.target.files?.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  }, [handleFiles]);

  // ─── Submit Handler ─────────────────────────────────────────────────────
  const handleSubmit = async (moveToReview = false) => {
    if (!comment.trim() && files.length === 0) return;
    if (!task?.id || !user?.id) return;

    setSubmitting(true);
    const totalSteps = files.length + 1;
    setProgress({ current: 0, total: totalSteps, label: 'Preparing...' });

    try {
      setProgress({ current: 0, total: totalSteps, label: `Compressing ${files.length} file(s)...` });

      const result = await submitProofOfWork({
        taskId: task.id,
        userId: user.id,
        comment: comment.trim(),
        files,
        moveToReview,
      });

      setProgress({ current: totalSteps, total: totalSteps, label: 'Done!' });

      // Reset state
      setComment('');
      setFiles([]);
      setSubmitting(false);
      setProgress({ current: 0, total: 0, label: '' });

      if (onSubmitSuccess) onSubmitSuccess(result, moveToReview);
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

  const canSubmit = (comment.trim().length > 0 || files.length > 0) && !submitting && !isLocked;

  if (!isOpen) return null;

  return (
    <TaskModal
      isOpen={isOpen}
      onClose={onClose}
      title={isLocked ? 'Proof of Work (Locked)' : 'Submit Proof of Work'}
      className="large-modal"
    >
      <div className="submission-modal-body">
        {/* Task Context */}
        {task && (
          <div style={{ marginBottom: '1rem' }}>
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

        {/* Rejection Feedback */}
        {task?.latestSubmission?.status === 'rejected' && (
          <div className="rejection-feedback-banner" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '12px', borderRadius: '8px', marginBottom: '16px', color: '#ef4444' }}>
            <strong style={{ display: 'block', marginBottom: '4px' }}>⚠️ Rework Required:</strong>
            {task.latestSubmission.rejection_reason}
          </div>
        )}

        {/* Locked Notice */}
        {isLocked && (
          <div className="submission-locked-notice">
            🔒 This task is in <strong>{task.stageId === 'REVIEW' ? 'Review' : 'Completed'}</strong> — submissions are locked. A manager must review existing proofs before changes can be made.
          </div>
        )}

        {/* Comment Section */}
        <div>
          <label className="submission-section-label">Comment</label>
          <textarea
            className="submission-comment-area"
            placeholder={isLocked ? 'Submissions locked for this task.' : 'Describe what was done, observations, or issues encountered...'}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={submitting || isLocked}
          />
        </div>

        {/* File Upload Zone */}
        {!isLocked && (
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
        )}

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
                {!isLocked && (
                  <button
                    className="file-chip-remove"
                    onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                    disabled={submitting}
                    title="Remove file"
                  >
                    ×
                  </button>
                )}
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
            {isLocked ? 'Close' : 'Cancel'}
          </button>

          {!isLocked && (
            <>
              <button
                className="halo-button submission-upload-only-btn"
                onClick={() => handleSubmit(false)}
                disabled={!canSubmit}
                title="Save proof without moving task stage"
              >
                {submitting ? 'Uploading...' : '📎 Upload Only'}
              </button>
              <button
                className="halo-button submission-submit-btn"
                onClick={() => handleSubmit(true)}
                disabled={!canSubmit}
                title="Save proof and move task to Review"
              >
                {submitting ? 'Submitting...' : '📤 Submit for Review'}
              </button>
            </>
          )}
        </div>
      </div>
    </TaskModal>
  );
};

export default SubmissionModal;
