/**
 * UnmarkedAttendanceActionPanel.jsx
 *
 * Shared Maker-Checker interactive panel rendered inside SubmissionHistory.jsx
 * for CONSECUTIVE_WEEKOFF_ESCALATION (Phase 2) and UNMARKED_ATTENDANCE (Phase 3)
 * tasks. Mirrors the Deactivate Employee approval card UX.
 *
 * Skill compliance:
 *   ui-design-system §1  (Zero inline styles)
 *   ui-design-system §14B (Touch targets >= 44px)
 *   development-best-practices §4 (Modular component)
 *   runtime-stability-and-coding-health (Safe destructuring, inFlightRef guard)
 */

import React, { useState, useRef } from 'react';
import CustomSelect from '../ui/CustomSelect';
import { IconCheck, IconX } from '../ui/Icons';
import {
  ATTENDANCE_TASK_TYPES,
  UNMARKED_ATTENDANCE_OPTIONS,
  getAttendanceOptionLabel,
  formatAttendanceShiftDate,
  isSubjectEmployeeOfAttendanceTask,
  getSubjectAttendanceWarningText,
  canMarkAttendanceTask,
  canReviewAttendanceTask,
  submitAttendanceTaskChoice,
  approveAttendanceTask,
  rejectAttendanceTask,
} from '../../services/employees/unmarkedAttendanceTaskService';
import './UnmarkedAttendanceActionPanel.css';

const UnmarkedAttendanceActionPanel = ({ task, currentUser, onActionComplete }) => {
  const meta = task?.metadata || {};
  const [selectedStatus, setSelectedStatus] = useState(meta.suggested_status || '');
  const [makerNote, setMakerNote] = useState(meta.maker_note || '');
  const [reviewNote, setReviewNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(null);
  const [actionError, setActionError] = useState(null);
  const inFlightRef = useRef(false);

  const isConsecutiveWO = meta.type === ATTENDANCE_TASK_TYPES.CONSECUTIVE_WEEKOFF;
  const canMark = canMarkAttendanceTask(task, currentUser);
  const canReview = canReviewAttendanceTask(task, currentUser);
  const isSubjectReadOnly =
    isSubjectEmployeeOfAttendanceTask(task, currentUser) && !canMark && !canReview;
  const isCompleted = task?.stageId === 'COMPLETED' || task?.stageId === 'DEPRIORITIZED';

  const handleMakerSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStatus || inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmittingAction('submit');
    setActionError(null);
    try {
      await submitAttendanceTaskChoice(task.id, selectedStatus, makerNote);
      if (onActionComplete) await onActionComplete();
    } catch (err) {
      setActionError(err?.message || 'Failed to submit attendance status.');
    } finally {
      inFlightRef.current = false;
      setSubmittingAction(null);
    }
  };

  const handleCheckerDecision = async (decision) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmittingAction(decision);
    setActionError(null);
    try {
      if (decision === 'approve') {
        await approveAttendanceTask(task.id, reviewNote);
      } else {
        await rejectAttendanceTask(task.id, reviewNote);
      }
      if (onActionComplete) await onActionComplete();
    } catch (err) {
      setActionError(err?.message || `Failed to ${decision} attendance task.`);
    } finally {
      inFlightRef.current = false;
      setSubmittingAction(null);
    }
  };

  return (
    <div className="attendance-task-panel">
      {/* Subject Employee Read-Only Awareness Banner */}
      {isSubjectReadOnly && !isCompleted && (
        <div className="attendance-task-panel__subject-banner" role="alert">
          <p className="attendance-task-panel__orphan-line">
            ⚠️ <strong>Read-Only Notice:</strong> {getSubjectAttendanceWarningText(task)}
          </p>
        </div>
      )}

      {/* Orphan Hierarchy Warning Banner */}
      {!isSubjectReadOnly && (meta.is_orphan_employee || meta.is_orphan_manager) && (
        <div className="attendance-task-panel__orphan-banner" role="alert">
          {meta.is_orphan_employee && (
            <p className="attendance-task-panel__orphan-line">
              ⚠️ <strong>ORPHAN EMPLOYEE:</strong> This employee has no active reporting manager assigned in the system.
            </p>
          )}
          {meta.is_orphan_manager && (
            <p className="attendance-task-panel__orphan-line">
              ⚠️ <strong>ORPHAN MANAGER:</strong> Submitting manager {meta.maker_name || 'N/A'} has no Editor or above in their reporting hierarchy.
            </p>
          )}
        </div>
      )}

      {/* Header */}
      <div className="attendance-task-panel__header">
        <h4 className="attendance-task-panel__title">
          {isConsecutiveWO ? '📅 Consecutive Week-Off Escalation' : '📋 Unmarked Attendance Closure'}
        </h4>
        <span className="attendance-task-panel__stage-pill">{task?.stageId || 'BACKLOG'}</span>
      </div>

      {/* Employee & Shift Context */}
      <div className="attendance-task-panel__meta-grid">
        <div className="attendance-task-panel__meta-item">
          <span className="attendance-task-panel__meta-label">Employee</span>
          <span className="attendance-task-panel__meta-value">
            {meta.employee_name || 'Unknown'} {meta.emp_code ? `(${meta.emp_code})` : ''}
          </span>
        </div>
        <div className="attendance-task-panel__meta-item">
          <span className="attendance-task-panel__meta-label">Shift Date</span>
          <span className="attendance-task-panel__meta-value">{formatAttendanceShiftDate(meta.shift_date)}</span>
        </div>
        <div className="attendance-task-panel__meta-item">
          <span className="attendance-task-panel__meta-label">Hub</span>
          <span className="attendance-task-panel__meta-value">{meta.hub_name || 'Unassigned Hub'}</span>
        </div>
      </div>

      {/* Previous Rejection Notice (shown to Maker when returned to BACKLOG) */}
      {task?.stageId === 'BACKLOG' && meta.last_rejection_note && (
        <div className="attendance-task-panel__rejection-note">
          <strong>Returned by {meta.rejected_by_name || 'Reviewer'}:</strong> {meta.last_rejection_note}
        </div>
      )}

      {/* Error Display */}
      {actionError && (
        <div className="attendance-task-panel__error" role="alert">
          {actionError}
        </div>
      )}

      {/* MAKER VIEW (BACKLOG) */}
      {task?.stageId === 'BACKLOG' && canMark && (
        <form className="attendance-task-panel__form" onSubmit={handleMakerSubmit}>
          <div className="attendance-task-panel__field">
            <label className="attendance-task-panel__label" htmlFor="attendance-task-status-select">
              Select Attendance Status (Present excluded)
            </label>
            <CustomSelect
              id="attendance-task-status-select"
              className="master-dropdown"
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val || '')}
              options={[
                { value: '', label: '— Choose status —' },
                ...UNMARKED_ATTENDANCE_OPTIONS,
              ]}
              required
            />
          </div>

          <div className="attendance-task-panel__field">
            <label className="attendance-task-panel__label" htmlFor="attendance-task-maker-note">
              Note (Optional)
            </label>
            <textarea
              id="attendance-task-maker-note"
              className="attendance-task-panel__textarea"
              rows={2}
              value={makerNote}
              onChange={(e) => setMakerNote(e.target.value)}
              placeholder="Add brief context for the approver…"
              disabled={Boolean(submittingAction)}
            />
          </div>

          <div className="attendance-task-panel__actions">
            <button
              type="submit"
              className="halo-button attendance-task-panel__btn attendance-task-panel__btn--primary"
              disabled={!selectedStatus || Boolean(submittingAction)}
            >
              {submittingAction === 'submit' ? 'Submitting…' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      )}

      {/* CHECKER VIEW (REVIEW) */}
      {task?.stageId === 'REVIEW' && (
        <div className="attendance-task-panel__review-box">
          <div className="attendance-task-panel__submission-summary">
            <div>
              <strong>Submitted By:</strong> {meta.maker_name || 'Reporting Manager'}
            </div>
            <div>
              <strong>Proposed Status:</strong>{' '}
              <span className="attendance-task-panel__status-badge">
                {getAttendanceOptionLabel(meta.suggested_status)}
              </span>
            </div>
            {meta.maker_note && (
              <div>
                <strong>Manager Note:</strong> {meta.maker_note}
              </div>
            )}
          </div>

          {canReview && (
            <>
              <div className="attendance-task-panel__field">
                <label className="attendance-task-panel__label" htmlFor="attendance-task-review-note">
                  Review Note (Optional)
                </label>
                <textarea
                  id="attendance-task-review-note"
                  className="attendance-task-panel__textarea"
                  rows={2}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Optional approval or rejection reason…"
                  disabled={Boolean(submittingAction)}
                />
              </div>

              <div className="attendance-task-panel__actions">
                <button
                  type="button"
                  className="halo-button attendance-task-panel__btn attendance-task-panel__btn--approve"
                  onClick={() => handleCheckerDecision('approve')}
                  disabled={Boolean(submittingAction)}
                >
                  {submittingAction === 'approve' ? (
                    'Approving…'
                  ) : (
                    <>
                      <IconCheck size={14} className="u-mr-4" /> Approve &amp; Mark Attendance
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="halo-button danger attendance-task-panel__btn"
                  onClick={() => handleCheckerDecision('reject')}
                  disabled={Boolean(submittingAction)}
                >
                  {submittingAction === 'reject' ? (
                    'Rejecting…'
                  ) : (
                    <>
                      <IconX size={14} className="u-mr-4" /> Reject to Manager
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* COMPLETED / RESOLVED VIEW */}
      {isCompleted && (
        <div className="attendance-task-panel__completed">
          {meta.auto_resolved ? (
            <p className="attendance-task-panel__completed-line">
              <strong>Auto-Resolved:</strong> {meta.review_note || 'Attendance was already marked via another flow.'}
            </p>
          ) : (
            <>
              <p className="attendance-task-panel__completed-line">
                <strong>Final Status:</strong> {getAttendanceOptionLabel(meta.suggested_status)}
              </p>
              <p className="attendance-task-panel__completed-line">
                <strong>Marked By:</strong> {meta.maker_name || '—'} · <strong>Approved By:</strong> {meta.checker_name || '—'}
              </p>
              {meta.review_note && (
                <p className="attendance-task-panel__completed-line">
                  <strong>Review Note:</strong> {meta.review_note}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default UnmarkedAttendanceActionPanel;
