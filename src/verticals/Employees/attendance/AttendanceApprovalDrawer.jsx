/**
 * AttendanceApprovalDrawer.jsx
 *
 * Slide-in approval panel for Editors (Checkers) to review, approve,
 * or reject pending attendance edit requests from Contributors (Makers).
 *
 * Props:
 *   isOpen          - Boolean (controls visibility)
 *   selectedCell    - { employeeId, date, record } | null (optional focus filter)
 *   pendingRequests - Array of pending request objects (from useAttendanceBoard)
 *   currentUser     - The logged-in user object
 *   onClose         - Function() → closes the drawer
 *   onActionComplete- Function() → called after approve/reject to refresh board
 *
 * Skill compliance:
 *   rbac-security-system §2 (Editor-level guard in parent Board Shell)
 *   ui-design-system §5 (Overlay pattern)
 *   ui-design-system §2 (halo-button for actions)
 *   safe-code-modification §2B (BEM naming, no inline styles)
 *   development-best-practices §3 (try/catch + error display)
 */

import React, { useState, useCallback } from 'react';
import { approveRequest, rejectRequest } from '../../../services/employees/editRequestService';
import '../../../components/tasks/TaskCard.css';

// ---------------------------------------------------------------------------
// STATUS_LABELS: Human-readable labels for the suggested_status enum
// ---------------------------------------------------------------------------
const STATUS_LABELS = {
  'present':  'Present',
  'week-off': 'Week-Off',
  'leave':    'Leave',
  'absent':   'Absent',
};

// ---------------------------------------------------------------------------
// RequestCard — renders a single pending request with Approve/Reject actions
// ---------------------------------------------------------------------------
const RequestCard = ({ request, onApprove, onReject, isActing }) => {
  const [showRejectNote, setShowRejectNote] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const handleRejectSubmit = () => {
    onReject(request, rejectNote);
    setShowRejectNote(false);
    setRejectNote('');
  };

  const formattedDate = new Date(request.shift_date + 'T00:00:00')
    .toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="task-card-master" style={{ '--stage-color': 'var(--brand-yellow)', marginBottom: '12px' }}>
      {/* Row 1: Meta */}
      <div className="card-row-1">
        <span className="card-priority priority-medium">
          {formattedDate}
        </span>
        {request.employees?.emp_code && (
          <span className="subtask-tag">
            {request.employees.emp_code}
          </span>
        )}
      </div>

      {/* Row 2: Title & Details */}
      <div className="card-row-2">
        <div className="card-row-2-title" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span className="card-task-name">{request.employees?.full_name}</span>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Suggested: <strong>{STATUS_LABELS[request.suggested_status] || request.suggested_status}</strong>
            {request.suggested_shift_type && ` • ${request.suggested_shift_type === 'day' ? '☀ Day' : '🌙 Night'}`}
          </div>
          {(request.suggested_first_login_time || request.suggested_logout_time) && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {request.suggested_first_login_time && `Login: ${new Date(request.suggested_first_login_time).toLocaleTimeString('en-IN')}`}
              {request.suggested_logout_time && ` | Logout: ${new Date(request.suggested_logout_time).toLocaleTimeString('en-IN')}`}
            </div>
          )}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Submitted by: {request.requester?.name || request.requester?.email}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {!showRejectNote ? (
        <div className="card-row-approval" style={{ padding: '8px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
          <button
            className="halo-button btn-approve"
            onClick={() => onApprove(request)}
            disabled={isActing}
            id={`approve-req-${request.id}`}
            style={{ flex: 1 }}
          >
            {isActing ? 'Applying…' : '✓ Approve'}
          </button>
          <button
            className="halo-button btn-reject"
            onClick={() => setShowRejectNote(true)}
            disabled={isActing}
            id={`reject-req-${request.id}`}
            style={{ flex: 1 }}
          >
            ✕ Reject
          </button>
        </div>
      ) : (
        <div className="approval-card__reject-note-form" style={{ padding: '8px', borderTop: '1px solid var(--border-color)' }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }} htmlFor={`reject-note-${request.id}`}>
            Rejection Reason (optional)
          </label>
          <textarea
            id={`reject-note-${request.id}`}
            className="master-input"
            style={{ width: '100%', padding: '8px', fontSize: '0.8rem', marginTop: '4px', marginBottom: '8px', minHeight: '60px' }}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Explain the rejection..."
            rows={2}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="halo-button btn-reject"
              onClick={handleRejectSubmit}
              disabled={isActing}
              style={{ flex: 1 }}
            >
              {isActing ? 'Rejecting…' : 'Confirm'}
            </button>
            <button
              className="halo-button"
              onClick={() => setShowRejectNote(false)}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// AttendanceApprovalDrawer — main export
// ---------------------------------------------------------------------------
const AttendanceApprovalDrawer = ({
  isOpen,
  selectedCell,
  pendingRequests,
  currentUser,
  onClose,
  onActionComplete,
}) => {
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState(null);

  // If a cell is selected, filter to just that cell's requests; otherwise show all
  const filteredRequests = selectedCell
    ? pendingRequests.filter(r =>
        r.employees?.id === selectedCell.employeeId &&
        r.shift_date === selectedCell.date
      )
    : pendingRequests;

  // ---------------------------------------------------------------------------
  // Approve handler — calls service, then triggers board refresh
  // ---------------------------------------------------------------------------
  const handleApprove = useCallback(async (request) => {
    setIsActing(true);
    setActionError(null);
    try {
      const { error } = await approveRequest({
        requestId:  request.id,
        reviewedBy: currentUser?.id,
        request,
      });
      if (error) throw error;
      onActionComplete();
    } catch (err) {
      console.error('[AttendanceApprovalDrawer] handleApprove error:', err);
      setActionError(err?.message || 'Failed to approve. Please try again.');
    } finally {
      setIsActing(false);
    }
  }, [currentUser, onActionComplete]);

  // ---------------------------------------------------------------------------
  // Reject handler
  // ---------------------------------------------------------------------------
  const handleReject = useCallback(async (request, reviewNote) => {
    setIsActing(true);
    setActionError(null);
    try {
      const { error } = await rejectRequest({
        requestId:  request.id,
        reviewedBy: currentUser?.id,
        reviewNote,
      });
      if (error) throw error;
      onActionComplete();
    } catch (err) {
      console.error('[AttendanceApprovalDrawer] handleReject error:', err);
      setActionError(err?.message || 'Failed to reject. Please try again.');
    } finally {
      setIsActing(false);
    }
  }, [currentUser, onActionComplete]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay (ui-design-system §5) */}
      <div
        className="approval-drawer__backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside className="approval-drawer" role="dialog" aria-modal="true" aria-label="Pending Approvals">
        <div className="approval-drawer__header">
          <h2 className="approval-drawer__title">
            Pending Approvals
            {!!pendingRequests.length && (
              <span className="attendance-board__pending-badge">
                {pendingRequests.length}
              </span>
            )}
          </h2>
          <button
            className="halo-button approval-drawer__close-btn"
            onClick={onClose}
            aria-label="Close approval drawer"
            id="approval-drawer-close"
          >
            ✕
          </button>
        </div>

        {/* Error state */}
        {actionError && (
          <div className="approval-drawer__error">
            <p>⚠ {actionError}</p>
          </div>
        )}

        {/* Request list */}
        <div className="approval-drawer__body custom-scrollbar">
          {filteredRequests.length === 0 ? (
            <div className="approval-drawer__empty">
              <p>No pending requests{selectedCell ? ' for this cell' : ''}.</p>
            </div>
          ) : (
            filteredRequests.map(request => (
              <RequestCard
                key={request.id}
                request={request}
                onApprove={handleApprove}
                onReject={handleReject}
                isActing={isActing}
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
};

export default AttendanceApprovalDrawer;
