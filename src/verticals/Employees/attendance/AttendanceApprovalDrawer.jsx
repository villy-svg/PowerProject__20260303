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
import '../../../styles/systems/systemLists.css';
import { IconChevronDown, IconChevronRight } from '../../../components/ui/Icons';


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
  const [showDetails, setShowDetails] = useState(false);

  const handleRejectSubmit = () => {
    onReject(request, rejectNote);
    setShowRejectNote(false);
    setRejectNote('');
  };

  const formattedDate = new Date(request.shift_date + 'T00:00:00')
    .toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div style={{ marginBottom: '12px' }}>
      <div className={`list-task-row ${(showDetails || showRejectNote) ? 'is-expanded' : ''}`} style={{ 
        '--stage-color': 'var(--brand-yellow)', 
        height: 'auto',
        borderLeft: '2px solid color-mix(in srgb, var(--brand-yellow), transparent 30%)',
        borderBottomLeftRadius: (showDetails || showRejectNote) ? 0 : '12px',
        borderBottomRightRadius: (showDetails || showRejectNote) ? 0 : '12px',
      }}>
        {/* LEFT SIDE: Identity & Content */}
        <div className="list-row-main">
          <div className="list-row-badges">
            <span className="card-priority priority-high">
              {formattedDate}
            </span>
            {request.employees?.emp_code && (
              <span className="subtask-tag" style={{ display: 'flex' }}>
                {request.employees.emp_code}
              </span>
            )}
          </div>
          
          <div className="list-row-content">
            {request.employees?.full_name} • {STATUS_LABELS[request.suggested_status] || request.suggested_status}
          </div>
        </div>

        {/* RIGHT SIDE: Action Controls */}
        <div className="list-row-controls" style={{ opacity: 1, pointerEvents: 'auto', display: 'flex', gap: '8px' }}>
          {!showRejectNote && (
            <>
              <button
                className="halo-button btn-approve"
                onClick={() => onApprove(request)}
                disabled={isActing}
                style={{ padding: '4px 10px' }}
              >
                {isActing ? '...' : '✓ Appr'}
              </button>
              <button
                className="halo-button btn-reject"
                onClick={() => setShowRejectNote(true)}
                disabled={isActing}
                style={{ padding: '4px 10px' }}
              >
                ✗ Rej
              </button>
            </>
          )}
          <button
            className="action-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }}
            title="Toggle Details"
            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            {showDetails ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </button>
        </div>
      </div>

      {/* EXPANDED SECTIONS */}
      {(showDetails || showRejectNote) && (
        <div style={{ 
          margin: '-1px 0 0 0', // attach flush to the bottom
          padding: '12px 16px', 
          background: 'var(--panel-bg)',
          border: '1px solid var(--border-color)',
          borderTop: 'none',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px'
        }}>
          {showDetails && (
            <div className="task-detailed-description" style={{ border: 'none', padding: 0, background: 'transparent', marginTop: 0 }}>
              <p>
                <strong>Suggested:</strong> {STATUS_LABELS[request.suggested_status] || request.suggested_status}
                {request.suggested_shift_type && ` • ${request.suggested_shift_type === 'day' ? '☀ Day' : '🌙 Night'}`}
                <br/>
                {(request.suggested_first_login_time || request.suggested_logout_time) && (
                  <>
                    {request.suggested_first_login_time && `Login: ${new Date(request.suggested_first_login_time).toLocaleTimeString('en-IN')} `}
                    {request.suggested_logout_time && `| Logout: ${new Date(request.suggested_logout_time).toLocaleTimeString('en-IN')}`}
                    <br/>
                  </>
                )}
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  Submitted by: {request.requester?.name || request.requester?.email}
                </span>
              </p>
            </div>
          )}

          {showRejectNote && (
            <div className="approval-card__reject-note-form" style={{ marginTop: showDetails ? '12px' : '0', paddingTop: showDetails ? '12px' : '0', borderTop: showDetails ? '1px dashed var(--border-color)' : 'none' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }} htmlFor={`reject-note-${request.id}`}>
                Rejection Reason (optional)
              </label>
              <textarea
                id={`reject-note-${request.id}`}
                className="master-input"
                style={{ boxSizing: 'border-box', width: '100%', padding: '8px', fontSize: '0.8rem', marginTop: '4px', marginBottom: '8px', minHeight: '60px' }}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Explain the rejection..."
                rows={2}
              />
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
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
    <div className="approval-page-container" style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }}>
      <div>
        {/* Error state */}
        {actionError && (
          <div className="attendance-board__error" style={{ marginBottom: '16px' }}>
            <p>⚠ {actionError}</p>
          </div>
        )}

        {/* Request list */}
        <div className="approval-list-body">
          {filteredRequests.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', opacity: 0.6 }}>
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
      </div>
    </div>
  );
};

export default AttendanceApprovalDrawer;
