import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getSubmissionsForTask, updateSubmissionStatus } from '../../services/tasks/submissionService';
import { employeeService } from '../../services/employees/employeeService';
import {
  REQUEST_TYPES,
  canReviewEmployeeRequests,
  approveBankUpdateRequest,
  approveDeactivationRequest,
  rejectEmployeeRequest,
} from '../../services/employees/employeeRequestService';
import { taskService } from '../../services/tasks/taskService';
import { useAuth } from '../../app/contexts/AuthContext';
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
  const inFlightRef = useRef(false); // Synchronous guard against rapid double-taps on mobile
  const { fetchUserProfile, realUser, impersonatedUser, handleImpersonate } = useAuth() || {};

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
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setUpdating(submissionId);
    try {
      const updated = await updateSubmissionStatus(submissionId, newStatus, reason);
      setSubmissions(prev =>
        prev.map(s => s.id === submissionId ? { ...s, status: updated.status, rejection_reason: updated.rejection_reason } : s)
      );
      setRejectionSubmission(null);
      if (onStatusUpdate) await onStatusUpdate(submissionId, newStatus);
    } catch (err) {
      alert(`Failed to ${newStatus}: ${err.message}`);
    } finally {
      inFlightRef.current = false;
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

  // Don't render if no submissions and not loading (and not an employee approval request)
  let bankUpdatePayload = null;
  let deactivationPayload = null;
  if (task?.description) {
    if (task.description.includes('"BANK_UPDATE"') || task.description.includes('"EMPLOYEE_DEACTIVATION"')) {
      try {
        const parsed = JSON.parse(task.description);
        if (parsed.type === REQUEST_TYPES.BANK_UPDATE) {
          bankUpdatePayload = parsed;
        } else if (parsed.type === REQUEST_TYPES.DEACTIVATION) {
          deactivationPayload = parsed;
        }
      } catch (e) {
        // Not JSON
      }
    }
  }

  // Master Admin, Master Editor, or Employees-vertical Editor/Admin can approve/reject employee requests.
  // Non-master requesters cannot self-approve their own request.
  const taskCreatorId = task?.createdBy || task?.created_by;
  const canReviewEmployeeReq = canReviewEmployeeRequests(currentUser) && (
    currentUser?.roleId === 'master_admin' ||
    (
      taskCreatorId !== currentUser?.id &&
      (bankUpdatePayload?.requestedBy || deactivationPayload?.requestedBy) !== currentUser?.id
    )
  );

  const refreshActiveAuthProfile = async () => {
    try {
      if (impersonatedUser?.id && typeof handleImpersonate === 'function') {
        await handleImpersonate(impersonatedUser.id);
      } else if (realUser?.id && typeof fetchUserProfile === 'function') {
        await fetchUserProfile(realUser.id);
      } else if (currentUser?.id && typeof fetchUserProfile === 'function') {
        await fetchUserProfile(currentUser.id);
      }
    } catch (e) {
      console.warn('[SubmissionHistory] Profile refresh after approval skipped:', e);
    }
  };

  const handleBankApproval = async (status) => {
    if (!bankUpdatePayload || inFlightRef.current) return;
    inFlightRef.current = true;
    setUpdating('bank_update');
    try {
      if (status === 'approved') {
        await approveBankUpdateRequest(task.id);
      } else {
        await rejectEmployeeRequest(task.id);
      }

      await refreshActiveAuthProfile();
      alert(`Bank Update ${status === 'approved' ? 'Approved & Applied' : 'Rejected'}.`);
      if (onStatusUpdate) await onStatusUpdate(); // close modal/refresh
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    } finally {
      inFlightRef.current = false;
      setUpdating(null);
    }
  };

  const handleDeactivationApproval = async (status) => {
    if (!deactivationPayload || inFlightRef.current) return;
    inFlightRef.current = true;
    setUpdating('deactivation');
    try {
      if (status === 'approved') {
        await approveDeactivationRequest(task.id);
      } else {
        // Reject does nothing to the employee record — only moves the request task out of REVIEW.
        await rejectEmployeeRequest(task.id);
      }

      await refreshActiveAuthProfile();
      alert(`Deactivation Request ${status === 'approved' ? 'Approved & Employee Marked Inactive' : 'Rejected'}.`);
      if (onStatusUpdate) await onStatusUpdate();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    } finally {
      inFlightRef.current = false;
      setUpdating(null);
    }
  };

  if (!loading && submissions.length === 0 && !bankUpdatePayload && !deactivationPayload) {
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
        <div className="bank-update-review-card employee-request-review-card">
          <h4 className="employee-request-review-title">
            🏦 Bank Details Update Request
          </h4>
          <p className="employee-request-review-subtitle">
            <strong>{bankUpdatePayload.employeeName}</strong> requested an update to their bank details.
          </p>

          <div className="employee-request-details-grid">
            <div className="employee-request-details-box">
              <div className="employee-request-details-header">Current Details</div>
              <div className="employee-request-details-list">
                <div><strong>A/C Name:</strong> {bankUpdatePayload.oldDetails?.accountName || 'N/A'}</div>
                <div><strong>A/C Number:</strong> {bankUpdatePayload.oldDetails?.accountNumber || 'N/A'}</div>
                <div><strong>IFSC:</strong> {bankUpdatePayload.oldDetails?.ifscCode || 'N/A'}</div>
                <div><strong>PAN:</strong> {bankUpdatePayload.oldDetails?.panNumber || 'N/A'}</div>
              </div>
            </div>
            <div className="employee-request-details-box employee-request-details-box--requested">
              <div className="employee-request-details-header employee-request-details-header--requested">Requested Details</div>
              <div className="employee-request-details-list">
                <div><strong>A/C Name:</strong> {bankUpdatePayload.newDetails?.accountName || 'N/A'}</div>
                <div><strong>A/C Number:</strong> {bankUpdatePayload.newDetails?.accountNumber || 'N/A'}</div>
                <div><strong>IFSC:</strong> {bankUpdatePayload.newDetails?.ifscCode || 'N/A'}</div>
                <div><strong>PAN:</strong> {bankUpdatePayload.newDetails?.panNumber || 'N/A'}</div>
              </div>
            </div>
          </div>

          {canReviewEmployeeReq && task.stageId !== 'COMPLETED' && task.stageId !== 'DEPRIORITIZED' && (
            <div className="employee-request-actions">
              <button 
                type="button" 
                className="halo-button" 
                onClick={() => handleBankApproval('approved')}
                disabled={updating === 'bank_update'}
              >
                {updating === 'bank_update' ? 'Processing...' : <><IconCheck size={14} className="u-mr-4" /> Approve & Update Employee</>}
              </button>
              <button 
                type="button" 
                className="halo-button danger" 
                onClick={() => handleBankApproval('rejected')}
                disabled={updating === 'bank_update'}
              >
                {updating === 'bank_update' ? 'Processing...' : <><IconX size={14} className="u-mr-4" /> Reject</>}
              </button>
            </div>
          )}
          {(task.stageId === 'COMPLETED' || task.stageId === 'DEPRIORITIZED') && (
            <div className="status-message u-mt-8">
              This request has been {task.stageId === 'COMPLETED' ? 'Approved' : 'Rejected'}.
            </div>
          )}
        </div>
      )}

      {deactivationPayload && (
        <div className="bank-update-review-card employee-request-review-card">
          <h4 className="employee-request-review-title">
            👤 Employee Deactivation Request
          </h4>
          <p className="employee-request-review-subtitle">
            <strong>{deactivationPayload.requestedByName || 'An editor'}</strong> requested to mark{' '}
            <strong>{deactivationPayload.employeeName}</strong> as <strong>Inactive</strong>.
          </p>

          {canReviewEmployeeReq && task.stageId !== 'COMPLETED' && task.stageId !== 'DEPRIORITIZED' && (
            <div className="employee-request-actions">
              <button
                type="button"
                className="halo-button"
                onClick={() => handleDeactivationApproval('approved')}
                disabled={updating === 'deactivation'}
              >
                {updating === 'deactivation' ? 'Processing...' : <><IconCheck size={14} className="u-mr-4" /> Approve & Mark Inactive</>}
              </button>
              <button
                type="button"
                className="halo-button danger"
                onClick={() => handleDeactivationApproval('rejected')}
                disabled={updating === 'deactivation'}
              >
                {updating === 'deactivation' ? 'Processing...' : <><IconX size={14} className="u-mr-4" /> Reject</>}
              </button>
            </div>
          )}
          {(task.stageId === 'COMPLETED' || task.stageId === 'DEPRIORITIZED') && (
            <div className="status-message u-mt-8">
              This request has been {task.stageId === 'COMPLETED' ? 'Approved' : 'Rejected'}.
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
