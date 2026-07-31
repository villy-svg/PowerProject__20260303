import React, { useState, useEffect, useCallback } from 'react';
import { getSubmissionsForTask, updateSubmissionStatus } from '../../services/tasks/submissionService';
import { employeeService } from '../../services/employees/employeeService';
import { taskService } from '../../services/tasks/taskService';
import RejectionModal from '../modals/RejectionModal';
import { IconDatabase, IconFile, IconCheck, IconX } from '../ui/Icons';
import './SubmissionHistory.css';

/**
 * SubmissionHistory
 * Displays all proof-of-work submissions for a task.
 * Managers (editor+) can approve/reject pending submissions inline.
 *
 * Props:
 * Props:
 * - taskId (string): The task ID to fetch submissions for
 * - task (object): The task object itself
 * - permissions (object): Current user's permissions ({ canUpdate, level })
 * - currentUser (object): Current user ({ id })
 * - onStatusUpdate (fn): Optional callback after a successful status change (submissionId, newStatus)
 */
const SubmissionHistory = ({ taskId, task, permissions = {}, currentUser = {}, onStatusUpdate, onCountLoad }) => {
  const [submissions, setSubmissions] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null); // tracks which submission is being updated
  const [rejectionSubmission, setRejectionSubmission] = useState(null); // tracks it for the modal

  const canReview = permissions.canUpdate || ['editor', 'admin'].includes(permissions.level);

  const fetchSubmissions = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const data = await getSubmissionsForTask(taskId);
      setSubmissions(data);
      // Auto-expand the newest submission if exists
      if (data.length > 0 && !expandedId) {
        setExpandedId(data[0].id);
      }
      if (onCountLoad) onCountLoad(data.length);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Handle accordion toggle
  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const handleStatusUpdate = async (submissionId, newStatus, reason = null) => {
    setUpdating(submissionId);
    try {
      const updated = await updateSubmissionStatus(submissionId, newStatus, reason);
      setSubmissions(prev =>
        prev.map(s => s.id === submissionId ? { ...s, status: updated.status, rejection_reason: updated.rejection_reason } : s)
      );
      setRejectionSubmission(null);
      if (onStatusUpdate) onStatusUpdate(submissionId, newStatus);
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

  // Don't render if no submissions and not loading (and not a bank update)
  let bankUpdatePayload = null;
  if (task?.description && task.description.includes('"BANK_UPDATE"')) {
    try {
      const parsed = JSON.parse(task.description);
      if (parsed.type === 'BANK_UPDATE') {
        bankUpdatePayload = parsed;
      }
    } catch (e) {
      // Not JSON
    }
  }

  const handleBankApproval = async (status) => {
    if (!bankUpdatePayload) return;
    setUpdating('bank_update');
    try {
      if (status === 'approved') {
        await employeeService.updateEmployeeBankDetails(bankUpdatePayload.employeeId, bankUpdatePayload.newDetails);
      }
      
      const newStage = status === 'approved' ? 'RESOLVED' : 'CANCELLED';
      await taskService.updateTaskStage(task.id, newStage, currentUser.id);
      
      alert(`Bank Update ${status === 'approved' ? 'Approved & Applied' : 'Rejected'}.`);
      if (onStatusUpdate) onStatusUpdate(); // close modal/refresh
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setUpdating(null);
    }
  };

  if (!loading && submissions.length === 0 && !bankUpdatePayload) {
    return (
      <div className="submission-history">
        <div className="submission-history-header">
          <span className="submission-history-title">
            <IconDatabase size={18} className="u-mr-8" />
            Submission History
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
          <IconDatabase size={18} className="u-mr-8" />
          Submission History
          {submissions.length > 0 && (
            <span className="submission-count-badge">{submissions.length}</span>
          )}
        </span>
      </div>

      {bankUpdatePayload && (
        <div className="bank-update-review-card u-mb-16" style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--surface-color)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
            🏦 Bank Details Update Request
          </h4>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <strong>{bankUpdatePayload.employeeName}</strong> requested an update to their bank details.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 'bold' }}>Current Details</div>
              <div style={{ fontSize: '0.85rem' }}>
                <div><strong>A/C Name:</strong> {bankUpdatePayload.oldDetails.accountName || 'N/A'}</div>
                <div><strong>A/C Number:</strong> {bankUpdatePayload.oldDetails.accountNumber || 'N/A'}</div>
                <div><strong>IFSC:</strong> {bankUpdatePayload.oldDetails.ifscCode || 'N/A'}</div>
                <div><strong>PAN:</strong> {bankUpdatePayload.oldDetails.panNumber || 'N/A'}</div>
              </div>
            </div>
            <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--brand-blue)' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--brand-blue)', marginBottom: '8px', fontWeight: 'bold' }}>Requested Details</div>
              <div style={{ fontSize: '0.85rem' }}>
                <div><strong>A/C Name:</strong> {bankUpdatePayload.newDetails.accountName || 'N/A'}</div>
                <div><strong>A/C Number:</strong> {bankUpdatePayload.newDetails.accountNumber || 'N/A'}</div>
                <div><strong>IFSC:</strong> {bankUpdatePayload.newDetails.ifscCode || 'N/A'}</div>
                <div><strong>PAN:</strong> {bankUpdatePayload.newDetails.panNumber || 'N/A'}</div>
              </div>
            </div>
          </div>

          {canReview && task.stageId !== 'RESOLVED' && task.stageId !== 'CANCELLED' && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button" 
                className="halo-button" 
                style={{ background: 'var(--success-color)', color: 'white', borderColor: 'var(--success-color)' }}
                onClick={() => handleBankApproval('approved')}
                disabled={updating === 'bank_update'}
              >
                {updating === 'bank_update' ? 'Processing...' : <><IconCheck size={14} className="u-mr-4" /> Approve & Update Employee</>}
              </button>
              <button 
                type="button" 
                className="halo-button secondary" 
                style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                onClick={() => handleBankApproval('rejected')}
                disabled={updating === 'bank_update'}
              >
                {updating === 'bank_update' ? 'Processing...' : <><IconX size={14} className="u-mr-4" /> Reject</>}
              </button>
            </div>
          )}
          {(task.stageId === 'RESOLVED' || task.stageId === 'CANCELLED') && (
            <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              This request has been {task.stageId === 'RESOLVED' ? 'Approved' : 'Rejected'}.
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="submission-loading">Loading submissions...</div>
      ) : (
        <div className="timeline-container">
          {submissions.map((submission, index) => {
            const isExpanded = expandedId === submission.id;
            // Detect submissions that were created during task creation or editing
            // by matching the standard comment strings set in useTaskController.js
            const isCreationAttachment =
              submission.comment === 'Attached photos during task creation.' ||
              submission.comment === 'Attached photos during task edit.';
            
            return (
              <div 
                className={`submission-item ${isExpanded ? 'expanded' : 'collapsed'}`} 
                key={submission.id}
              >
                {/* Timeline node & line */}
                <div className="timeline-marker">
                  <div className={`status-node ${submission.status}`}></div>
                  {index < submissions.length - 1 && <div className="timeline-line"></div>}
                </div>

                <div className="submission-content">
                  {isExpanded ? (
                    <div className="submission-card fade-in">
                      {/* Header: number + submitter + timestamp + status */}
                      <div className="submission-card-header" onClick={() => toggleExpand(submission.id)}>
                        <div className="submission-card-meta">
                          <span className="submission-number-badge">
                            #{submission.submission_number}
                          </span>
                          {isCreationAttachment && (
                            <span className="submission-creation-label" title="These files were attached when this task was created or last edited">
                              📎 Creation Attachments
                            </span>
                          )}
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
                            onClick={() => handleStatusUpdate(submission.id, 'approved')}
                            disabled={updating === submission.id}
                          >
                            {updating === submission.id ? '...' : <><IconCheck size={14} className="u-mr-4" /> Approve</>}
                          </button>
                          <button
                            type="button"
                            className="submission-reject-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRejectionSubmission(submission);
                            }}
                            disabled={updating === submission.id}
                          >
                            {updating === submission.id ? '...' : <><IconX size={14} className="u-mr-4" /> Reject</>}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div 
                      className="submission-summary-row" 
                      onClick={() => toggleExpand(submission.id)}
                    >
                      <div className="summary-left">
                        <span className="submission-number-badge">#{submission.submission_number}</span>
                        {isCreationAttachment ? (
                          <span className="submission-creation-label summary-creation-label">📎 Creation Attachments</span>
                        ) : (
                          <span className="submission-submitter">{getSubmitterName(submission)}</span>
                        )}
                      </div>
                      <div className="summary-right">
                        <span className={`submission-status-badge minified ${submission.status}`}>
                          {submission.status}
                        </span>
                        <span className="submission-timestamp">{formatDate(submission.created_at)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RejectionModal
        isOpen={!!rejectionSubmission}
        onClose={() => setRejectionSubmission(null)}
        task={{ text: rejectionSubmission ? `Submission #${rejectionSubmission.submission_number}` : '' }}
        onSubmit={(reason) => handleStatusUpdate(rejectionSubmission.id, 'rejected', reason)}
      />
    </div>
  );
};

export default SubmissionHistory;
