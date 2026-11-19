import React from 'react';
import { IconFile, IconCheck, IconX } from '../../../components/ui/Icons';

/**
 * SubmissionTimelineRow
 * Pure presentational timeline row for `kind === 'submission'` proof-of-work items.
 * Extracted from SubmissionHistory.jsx to keep the container lean and modular.
 *
 * Canonical location: src/features/task-history/components/SubmissionTimelineRow.jsx
 */
const SubmissionTimelineRow = ({
  submission,
  isExpanded = false,
  onToggle,
  isLast = false,
  canReview = false,
  updating = null,
  onApprove,
  onRequestReject,
  submitterName = 'Unknown',
  formatDate,
}) => {
  if (!submission) return null;

  // Detect submissions created automatically during task creation or editing
  // by matching the standard comment strings set in useTaskController.js
  const isCreationAttachment =
    submission.comment === 'Attached photos during task creation.' ||
    submission.comment === 'Attached photos during task edit.';

  const formattedTime = submission.created_at
    ? (formatDate ? formatDate(submission.created_at) : submission.created_at)
    : '';
  const isUpdatingThis = updating === submission.id;

  return (
    <div className={`submission-item ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Timeline node & line */}
      <div className="timeline-marker" aria-hidden="true">
        <div className={`status-node ${submission.status}`} />
        {!isLast && <div className="timeline-line" />}
      </div>

      <div className="submission-content">
        {isExpanded ? (
          <div className="submission-card fade-in">
            {/* Header: number + submitter + timestamp + status */}
            <button
              type="button"
              className="submission-card-header"
              onClick={onToggle}
              aria-expanded="true"
            >
              <span className="submission-card-meta">
                <span className="submission-number-badge">
                  #{submission.submission_number}
                </span>
                {isCreationAttachment && (
                  <span
                    className="submission-creation-label"
                    title="These files were attached when this task was created or last edited"
                  >
                    📎 Creation Attachments
                  </span>
                )}
                <span className="submission-submitter">{submitterName}</span>
                <span className="submission-timestamp">{formattedTime}</span>
              </span>
              <span className={`submission-status-badge ${submission.status}`}>
                {submission.status}
              </span>
            </button>

            {/* Comment */}
            {submission.comment && (
              <p className="submission-comment-text">{submission.comment}</p>
            )}

            {/* Attachments */}
            {Array.isArray(submission.links) && submission.links.length > 0 && (
              <div className="submission-attachments">
                {submission.links.map((link, idx) => {
                  const isImage = link.mime_type?.startsWith('image/');
                  if (isImage) {
                    return (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={link.file_name}
                      >
                        <img
                          className="submission-attachment-thumb"
                          src={link.url}
                          alt={link.file_name || 'Submission attachment'}
                        />
                      </a>
                    );
                  }
                  return (
                    <a
                      key={idx}
                      className="submission-attachment-file"
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={link.file_name}
                    >
                      <IconFile size={16} className="u-mr-6" />
                      {link.file_name}
                    </a>
                  );
                })}
              </div>
            )}

            {/* Approve / Reject actions (editor+ only, pending only) */}
            {canReview && submission.status === 'pending' && (
              <div className="submission-card-actions">
                <button
                  type="button"
                  className="submission-approve-btn"
                  onClick={() => onApprove && onApprove(submission.id)}
                  disabled={isUpdatingThis}
                >
                  {isUpdatingThis ? '...' : <><IconCheck size={14} className="u-mr-4" /> Approve</>}
                </button>
                <button
                  type="button"
                  className="submission-reject-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRequestReject) onRequestReject(submission);
                  }}
                  disabled={isUpdatingThis}
                >
                  {isUpdatingThis ? '...' : <><IconX size={14} className="u-mr-4" /> Reject</>}
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="submission-summary-row"
            onClick={onToggle}
            aria-expanded="false"
          >
            <span className="summary-left">
              <span className="submission-number-badge">#{submission.submission_number}</span>
              {isCreationAttachment ? (
                <span className="submission-creation-label summary-creation-label">
                  📎 Creation Attachments
                </span>
              ) : (
                <span className="submission-submitter">{submitterName}</span>
              )}
            </span>
            <span className="summary-right">
              <span className={`submission-status-badge minified ${submission.status}`}>
                {submission.status}
              </span>
              <span className="submission-timestamp">{formattedTime}</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default SubmissionTimelineRow;
