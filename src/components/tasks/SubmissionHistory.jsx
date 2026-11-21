import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getSubmissionsForTask, updateSubmissionStatus } from '../../services/tasks/submissionService';
import {
  REQUEST_TYPES,
  canReviewEmployeeRequests,
  approveBankUpdateRequest,
  approveDeactivationRequest,
  rejectEmployeeRequest,
} from '../../services/employees/employeeRequestService';
import { isAttendanceClosureTask } from '../../services/employees/unmarkedAttendanceTaskService';
import UnmarkedAttendanceActionPanel from './UnmarkedAttendanceActionPanel';
import { useAuth } from '../../app/contexts/AuthContext';
import RejectionModal from '../modals/RejectionModal';
import { IconDatabase, IconCheck, IconX } from '../ui/Icons';
import {
  getTaskHistory,
  mergeUnifiedTimeline,
  groupTimelineByDate,
  createEmptyLookupMaps,
  TaskHistoryEventRow,
  SubmissionTimelineRow,
} from '../../features/task-history';
import './SubmissionHistory.css';

/**
 * SubmissionHistory
 * Displays the unified, newest-first Task & Submission History timeline for a task.
 * Combines proof-of-work submissions (`public.submissions`) with task audit events
 * (`public.tasks_history`), gracefully degrading to submissions-only if the history
 * RPC is unavailable. Managers (editor+) can approve/reject pending submissions inline.
 *
 * Props:
 * - taskId (string): The task ID to fetch submissions & history for
 * - task (object): The task object itself
 * - permissions (object): Current user's permissions ({ canUpdate, level })
 * - currentUser (object): Current user ({ id, roleId })
 * - onStatusUpdate (fn): Optional callback after a successful status change (submissionId, newStatus)
 * - onCountLoad (fn): Optional callback receiving proof-of-work submission count
 */
const SubmissionHistory = ({ taskId, task, permissions = {}, currentUser = {}, onStatusUpdate, onCountLoad }) => {
  const [submissions, setSubmissions] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [lookupMaps, setLookupMaps] = useState(() => createEmptyLookupMaps());
  const [historyDegraded, setHistoryDegraded] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'submissions' | 'changes'
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [rejectionSubmission, setRejectionSubmission] = useState(null);

  const inFlightRef = useRef(false); // Synchronous guard against rapid double-taps on mobile
  const isMountedRef = useRef(true);
  const fetchSeqRef = useRef(0);
  const autoExpandedTaskRef = useRef(null);
  const taskRef = useRef(task);
  const onCountLoadRef = useRef(onCountLoad);

  taskRef.current = task;
  onCountLoadRef.current = onCountLoad;

  const { fetchUserProfile, realUser, impersonatedUser, handleImpersonate } = useAuth() || {};
  const canReview = permissions.canUpdate || ['editor', 'admin'].includes(permissions.level);
  const taskUpdatedAt = task?.updated_at || task?.updatedAt || null;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset UI state cleanly when switching between tasks in the same modal
  useEffect(() => {
    setExpandedId(null);
    setActiveFilter('all');
    autoExpandedTaskRef.current = null;
  }, [taskId]);

  const fetchTimeline = useCallback(async ({ signal = null, silent = false } = {}) => {
    if (!taskId) {
      setLoading(false);
      return;
    }

    const seq = ++fetchSeqRef.current;
    if (!silent) setLoading(true);

    try {
      const [subResult, histResult] = await Promise.allSettled([
        getSubmissionsForTask(taskId),
        getTaskHistory(taskId, { task: taskRef.current, signal }),
      ]);

      if (!isMountedRef.current || signal?.aborted || seq !== fetchSeqRef.current) return;

      if (subResult.status === 'fulfilled') {
        const subData = Array.isArray(subResult.value) ? subResult.value : [];
        setSubmissions(subData);
        if (onCountLoadRef.current) onCountLoadRef.current(subData.length);

        // Auto-expand the newest submission once per taskId; history rows stay collapsed
        if (subData.length > 0 && autoExpandedTaskRef.current !== taskId) {
          setExpandedId(`sub_${subData[0].id}`);
          autoExpandedTaskRef.current = taskId;
        }
      } else {
        console.error('Failed to load submissions:', subResult.reason);
      }

      if (histResult.status === 'fulfilled' && histResult.value) {
        setHistoryRows(Array.isArray(histResult.value.rows) ? histResult.value.rows : []);
        setLookupMaps(histResult.value.lookupMaps || createEmptyLookupMaps());
        setHistoryDegraded(Boolean(histResult.value.degraded));
      } else {
        if (histResult.status === 'rejected') {
          console.warn('[SubmissionHistory] History fetch degraded to submissions-only:', histResult.reason);
        }
        setHistoryRows([]);
        setLookupMaps(createEmptyLookupMaps());
        setHistoryDegraded(true);
      }
    } catch (err) {
      console.error('Failed to load task timeline:', err);
    } finally {
      if (isMountedRef.current && seq === fetchSeqRef.current && !silent) {
        setLoading(false);
      }
    }
  }, [taskId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchTimeline({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchTimeline, taskUpdatedAt]);

  const toggleExpand = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const formatDate = useCallback((dateStr) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const getSubmitterName = useCallback((submission) => {
    const profile = submission?.submitted_by_profile;
    if (!profile) return 'Unknown';
    if (submission.submitted_by === currentUser?.id) return 'YOU';
    return profile.name || profile.email || 'Unknown';
  }, [currentUser?.id]);

  // Unified timeline assembly & filtering
  const unifiedTimeline = useMemo(
    () => mergeUnifiedTimeline({ submissions, historyRows, lookupMaps, task, currentUser }),
    [submissions, historyRows, lookupMaps, task, currentUser]
  );

  const changeCount = useMemo(
    () => unifiedTimeline.filter((item) => item.kind === 'history').length,
    [unifiedTimeline]
  );

  const filteredTimeline = useMemo(() => {
    if (activeFilter === 'submissions') {
      return unifiedTimeline.filter((item) => item.kind === 'submission');
    }
    if (activeFilter === 'changes') {
      return unifiedTimeline.filter((item) => item.kind === 'history');
    }
    return unifiedTimeline;
  }, [unifiedTimeline, activeFilter]);

  const groupedTimeline = useMemo(
    () => groupTimelineByDate(filteredTimeline),
    [filteredTimeline]
  );

  // Parse structured employee approval requests (Bank Update / Deactivation)
  const { bankUpdatePayload, deactivationPayload } = useMemo(() => {
    let bank = null;
    let deactivation = null;
    const desc = task?.description;
    if (desc && (desc.includes('"BANK_UPDATE"') || desc.includes('"EMPLOYEE_DEACTIVATION"'))) {
      try {
        const parsed = JSON.parse(desc);
        if (parsed.type === REQUEST_TYPES.BANK_UPDATE) bank = parsed;
        else if (parsed.type === REQUEST_TYPES.DEACTIVATION) deactivation = parsed;
      } catch {
        // Not valid JSON
      }
    }
    return { bankUpdatePayload: bank, deactivationPayload: deactivation };
  }, [task?.description]);

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

  const handleStatusUpdate = async (submissionId, newStatus, reason = null) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setUpdating(submissionId);
    try {
      const updated = await updateSubmissionStatus(submissionId, newStatus, reason);
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? { ...s, status: updated.status, rejection_reason: updated.rejection_reason }
            : s
        )
      );
      setRejectionSubmission(null);
      if (onStatusUpdate) await onStatusUpdate(submissionId, newStatus);
      // Re-fetch so stage transition triggered by review appears immediately at top
      if (isMountedRef.current) await fetchTimeline({ silent: true });
    } catch (err) {
      alert(`Failed to ${newStatus}: ${err.message}`);
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) setUpdating(null);
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
      if (onStatusUpdate) await onStatusUpdate();
      if (isMountedRef.current) await fetchTimeline({ silent: true });
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) setUpdating(null);
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
      if (isMountedRef.current) await fetchTimeline({ silent: true });
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) setUpdating(null);
    }
  };

  const isAttendanceTask = isAttendanceClosureTask(task);
  const isTaskResolved = task?.stageId === 'COMPLETED' || task?.stageId === 'DEPRIORITIZED';
  const showFilterBar = unifiedTimeline.length > 0 && !historyDegraded;

  if (!loading && unifiedTimeline.length === 0 && !bankUpdatePayload && !deactivationPayload && !isAttendanceTask) {
    return (
      <div className="submission-history">
        <div className="submission-history-header">
          <span className="submission-history-title">
            <IconDatabase size={18} className="u-mr-8" />
            Task &amp; Submission History
          </span>
        </div>
        <div className="submission-empty-state">
          No activity or submissions yet.
        </div>
      </div>
    );
  }

  return (
    <div className="submission-history">
      <div className="submission-history-header">
        <span className="submission-history-title">
          <IconDatabase size={18} className="u-mr-8" />
          Task &amp; Submission History
          {unifiedTimeline.length > 0 && (
            <span className="submission-count-badge">{unifiedTimeline.length}</span>
          )}
        </span>

        {showFilterBar && (
          <div className="timeline-filter-bar" role="group" aria-label="Filter timeline">
            <button
              type="button"
              className={`timeline-filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
              aria-pressed={activeFilter === 'all'}
              onClick={() => setActiveFilter('all')}
            >
              All ({unifiedTimeline.length})
            </button>
            <button
              type="button"
              className={`timeline-filter-pill ${activeFilter === 'submissions' ? 'active' : ''}`}
              aria-pressed={activeFilter === 'submissions'}
              onClick={() => setActiveFilter('submissions')}
            >
              Submissions ({submissions.length})
            </button>
            <button
              type="button"
              className={`timeline-filter-pill ${activeFilter === 'changes' ? 'active' : ''}`}
              aria-pressed={activeFilter === 'changes'}
              onClick={() => setActiveFilter('changes')}
            >
              Changes ({changeCount})
            </button>
          </div>
        )}
      </div>

      {isAttendanceTask && (
        <UnmarkedAttendanceActionPanel
          task={task}
          currentUser={currentUser}
          onActionComplete={async () => {
            if (onStatusUpdate) await onStatusUpdate();
            if (isMountedRef.current) await fetchTimeline({ silent: true });
          }}
        />
      )}

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

          {canReviewEmployeeReq && !isTaskResolved && (
            <div className="employee-request-actions">
              <button
                type="button"
                className="halo-button"
                onClick={() => handleBankApproval('approved')}
                disabled={updating === 'bank_update'}
              >
                {updating === 'bank_update' ? 'Processing...' : <><IconCheck size={14} className="u-mr-4" /> Approve &amp; Update Employee</>}
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
          {isTaskResolved && (
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

          {canReviewEmployeeReq && !isTaskResolved && (
            <div className="employee-request-actions">
              <button
                type="button"
                className="halo-button"
                onClick={() => handleDeactivationApproval('approved')}
                disabled={updating === 'deactivation'}
              >
                {updating === 'deactivation' ? 'Processing...' : <><IconCheck size={14} className="u-mr-4" /> Approve &amp; Mark Inactive</>}
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
          {isTaskResolved && (
            <div className="status-message u-mt-8">
              This request has been {task.stageId === 'COMPLETED' ? 'Approved' : 'Rejected'}.
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="submission-loading">Loading activity &amp; submissions...</div>
      ) : filteredTimeline.length === 0 ? (
        <div className="submission-empty-state">
          {activeFilter === 'submissions'
            ? 'No proof-of-work submissions yet.'
            : 'No task changes recorded yet.'}
        </div>
      ) : (
        <div className="timeline-container">
          {groupedTimeline.map((group) => (
            <div className="timeline-date-group" key={group.dateKey}>
              <div className="timeline-date-divider">{group.label}</div>
              {group.items.map((item, idx) => {
                const isLastInGroup = idx === group.items.length - 1;
                if (item.kind === 'history') {
                  return (
                    <TaskHistoryEventRow
                      key={item.id}
                      item={item}
                      isExpanded={expandedId === item.id}
                      onToggle={() => toggleExpand(item.id)}
                      isLast={isLastInGroup}
                      formatDate={formatDate}
                    />
                  );
                }

                return (
                  <SubmissionTimelineRow
                    key={item.id}
                    submission={item.data}
                    isExpanded={expandedId === item.id}
                    onToggle={() => toggleExpand(item.id)}
                    isLast={isLastInGroup}
                    canReview={canReview}
                    updating={updating}
                    onApprove={(submissionId) => handleStatusUpdate(submissionId, 'approved')}
                    onRequestReject={(submission) => setRejectionSubmission(submission)}
                    submitterName={getSubmitterName(item.data)}
                    formatDate={formatDate}
                  />
                );
              })}
            </div>
          ))}
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
