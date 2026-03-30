import React, { useState, useEffect, useCallback } from 'react';
import { getSubmissionsForTask, updateSubmissionStatus } from '../services/tasks/submissionService';
import './SubmissionHistory.css';

/**
 * SubmissionHistory
 * Displays all proof-of-work submissions for a task.
 * Managers (editor+) can approve/reject pending submissions inline.
 *
 * Props:
 * - taskId (string): The task ID to fetch submissions for
 * - permissions (object): Current user's permissions ({ canUpdate, level })
 * - currentUser (object): Current user ({ id })
 */
const SubmissionHistory = ({ taskId, permissions = {}, currentUser = {} }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null); // tracks which submission is being updated

  const canReview = permissions.canUpdate || ['editor', 'admin'].includes(permissions.level);

  const fetchSubmissions = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const data = await getSubmissionsForTask(taskId);
      setSubmissions(data);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleStatusUpdate = async (submissionId, newStatus) => {
    setUpdating(submissionId);
    try {
      const updated = await updateSubmissionStatus(submissionId, newStatus);
      setSubmissions(prev =>
        prev.map(s => s.id === submissionId ? { ...s, status: updated.status } : s)
      );
    } catch (err) {
      alert(`Failed to ${newStatus}: ${err.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSubmitterName = (submission) => {
    const profile = submission.submitted_by_profile;
    if (!profile) return 'Unknown';
    if (submission.submitted_by === currentUser.id) return 'YOU';
    return profile.name || profile.email || 'Unknown';
  };

  // Don't render if no submissions and not loading
  if (!loading && submissions.length === 0) {
    return (
      <div className="submission-history">
        <div className="submission-history-header">
          <span className="submission-history-title">
            📋 Submission History
          </span>
        </div>
        <div className="submission-empty-state">
          No proof-of-work submissions yet.
        </div>
      </div>
    );
  }

  return (
    <div className="submission-history">
      <div className="submission-history-header">
        <span className="submission-history-title">
          📋 Submission History
          {submissions.length > 0 && (
            <span className="submission-count-badge">{submissions.length}</span>
          )}
        </span>
      </div>

      {loading ? (
        <div className="submission-loading">Loading submissions...</div>
      ) : (
        submissions.map((submission) => (
          <div className="submission-card" key={submission.id}>
            {/* Header: number + submitter + timestamp + status */}
            <div className="submission-card-header">
              <div className="submission-card-meta">
                <span className="submission-number-badge">
                  #{submission.submission_number}
                </span>
                <span className="submission-submitter">
                  {getSubmitterName(submission)}
                </span>
                <span className="submission-timestamp">
                  {formatDate(submission.created_at)}
                </span>
              </div>
              <span className={`submission-status-badge ${submission.status}`}>
                {submission.status}
              </span>
            </div>

            {/* Comment */}
            {submission.comment && (
              <p className="submission-comment-text">{submission.comment}</p>
            )}

            {/* Attachments */}
            {submission.links && submission.links.length > 0 && (
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
                          alt={link.file_name}
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
                      📄 {link.file_name}
                    </a>
                  );
                })}
              </div>
            )}

            {/* Approve / Reject actions (editor+ only, pending only) */}
            {canReview && submission.status === 'pending' && (
              <div className="submission-card-actions">
                <button
                  className="submission-approve-btn"
                  onClick={() => handleStatusUpdate(submission.id, 'approved')}
                  disabled={updating === submission.id}
                >
                  {updating === submission.id ? '...' : '✓ Approve'}
                </button>
                <button
                  className="submission-reject-btn"
                  onClick={() => handleStatusUpdate(submission.id, 'rejected')}
                  disabled={updating === submission.id}
                >
                  {updating === submission.id ? '...' : '✗ Reject'}
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default SubmissionHistory;
