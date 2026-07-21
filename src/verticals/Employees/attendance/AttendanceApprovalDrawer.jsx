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
const RequestCard = ({ request, onApprove, onReject, isActing, isSelected, onToggleSelect }) => {
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
    <div className="u-mb-12">
      <div className={`list-task-row u-h-auto u-pl-12 ${(showDetails || showRejectNote) ? 'is-expanded' : ''}`} style={{ 
        '--stage-color': 'var(--brand-yellow)', 
        borderBottomLeftRadius: (showDetails || showRejectNote) ? 0 : 'var(--radius-button, 12px)',
        borderBottomRightRadius: (showDetails || showRejectNote) ? 0 : 'var(--radius-button, 12px)',
      }}>
        {/* CHECKBOX FOR BULK ACTION */}
        <div className="u-flex-center u-mr-12">
          <input 
            type="checkbox" 
            checked={isSelected} 
            onChange={() => onToggleSelect(request.id)}
            className="checkbox-sm"
          />
        </div>

        {/* LEFT SIDE: Identity & Content */}
        <div className="list-row-main u-flex-1">
          <div className="list-row-badges">
            <span className="card-priority priority-high">
              {formattedDate}
            </span>
            {request.employees?.emp_code && (
              <span className="subtask-tag u-flex">
                {request.employees.emp_code}
              </span>
            )}
            {request.suggested_leave_type && (
              <span className="subtask-tag u-flex u-text-brand-purple u-border-brand-purple">
                {request.suggested_leave_type}
              </span>
            )}
          </div>
          
          <div className="list-row-content">
            {request.employees?.full_name} • {STATUS_LABELS[request.suggested_status] || request.suggested_status}
          </div>
        </div>

        {/* RIGHT SIDE: Action Controls */}
        <div className="list-row-controls u-flex-gap-8 u-opacity-100 u-pointer-events-auto">
          {!showRejectNote && (
            <>
              <button
                className="halo-button btn-xs btn-approve"
                onClick={() => onApprove(request)}
                disabled={isActing}
              >
                {isActing ? '...' : '✓ Appr'}
              </button>
              <button
                className="halo-button btn-xs btn-reject"
                onClick={() => setShowRejectNote(true)}
                disabled={isActing}
              >
                ✗ Rej
              </button>
            </>
          )}
          <button
            className="action-icon-btn u-text-secondary"
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }}
            title="Toggle Details"
          >
            {showDetails ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </button>
        </div>
      </div>

      {/* EXPANDED SECTIONS */}
      {(showDetails || showRejectNote) && (
        <div className="expanded-details-panel">
          {showDetails && (
            <div className="task-detailed-description u-border-none u-p-0 u-bg-transparent u-m-0">
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
                {request.maker_note && (
                  <>
                    <strong>Reason: </strong> {request.maker_note}
                    <br/>
                  </>
                )}
                <span className="u-text-tertiary u-text-sm-75 u-mt-4 u-block">
                  Submitted by: {request.requester?.name || request.requester?.email}
                </span>
              </p>
            </div>
          )}

          {showRejectNote && (
            <div className={`approval-card__reject-note-form ${showDetails ? 'u-mt-12 u-pt-12 u-border-t-dashed' : 'u-mt-0 u-pt-0 u-border-t-none'}`}>
              <label className="form-label u-text-sm-75" htmlFor={`reject-note-${request.id}`}>
                Rejection Reason (optional)
              </label>
              <textarea
                id={`reject-note-${request.id}`}
                className="master-input u-w-full u-p-8 u-text-sm u-mt-4 u-mb-8 u-min-h-60 u-box-border"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Explain the rejection..."
                rows={2}
              />
              <div className="u-flex-gap-8 u-w-full">
                <button
                  className="halo-button btn-reject u-flex-1"
                  onClick={handleRejectSubmit}
                  disabled={isActing}
                >
                  {isActing ? 'Rejecting…' : 'Confirm'}
                </button>
                <button
                  className="halo-button u-flex-1"
                  onClick={() => setShowRejectNote(false)}
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
  const [selectedIds, setSelectedIds] = useState([]);

  // If a cell is selected, filter to just that cell's requests; otherwise show all
  const filteredRequests = selectedCell
    ? pendingRequests.filter(r =>
        r.employees?.id === selectedCell.employeeId &&
        r.shift_date === selectedCell.date
      )
    : pendingRequests;

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredRequests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRequests.map(r => r.id));
    }
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

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
      setSelectedIds(prev => prev.filter(id => id !== request.id));
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
      setSelectedIds(prev => prev.filter(id => id !== request.id));
      onActionComplete();
    } catch (err) {
      console.error('[AttendanceApprovalDrawer] handleReject error:', err);
      setActionError(err?.message || 'Failed to reject. Please try again.');
    } finally {
      setIsActing(false);
    }
  }, [currentUser, onActionComplete]);

  const handleBulkApprove = async () => {
    setIsActing(true);
    setActionError(null);
    try {
      const requestsToApprove = filteredRequests.filter(r => selectedIds.includes(r.id));
      for (const request of requestsToApprove) {
        const { error } = await approveRequest({
          requestId: request.id,
          reviewedBy: currentUser?.id,
          request
        });
        if (error) throw error;
      }
      setSelectedIds([]);
      onActionComplete();
    } catch {
      setActionError('Failed to bulk approve some requests.');
    } finally {
      setIsActing(false);
    }
  };

  const handleBulkReject = async () => {
    setIsActing(true);
    setActionError(null);
    try {
      const requestsToReject = filteredRequests.filter(r => selectedIds.includes(r.id));
      for (const request of requestsToReject) {
        const { error } = await rejectRequest({
          requestId: request.id,
          reviewedBy: currentUser?.id,
          reviewNote: 'Bulk Rejected'
        });
        if (error) throw error;
      }
      setSelectedIds([]);
      onActionComplete();
    } catch {
      setActionError('Failed to bulk reject some requests.');
    } finally {
      setIsActing(false);
    }
  };

  if (!isOpen) return null;

  const isAllSelected = filteredRequests.length > 0 && selectedIds.length === filteredRequests.length;

  return (
    <div className="approval-page-container u-flex-1 u-overflow-y-auto u-px-16 u-py-24">
      <div>
        {/* Bulk Actions Header */}
        {filteredRequests.length > 0 && (
          <div className="u-flex-between u-mb-16 u-px-12">
            <label className="u-flex-center-gap-8 u-cursor-pointer">
              <input 
                type="checkbox" 
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="checkbox-sm"
              />
              <span className="u-text-base u-fw-600">Select All</span>
            </label>

            {selectedIds.length > 0 && (
              <div className="u-flex-gap-12">
                <button 
                  className="halo-button btn-sm btn-approve"
                  onClick={handleBulkApprove}
                  disabled={isActing}
                >
                  ✓ Approve ({selectedIds.length})
                </button>
                <button 
                  className="halo-button btn-sm btn-reject"
                  onClick={handleBulkReject}
                  disabled={isActing}
                >
                  ✗ Reject ({selectedIds.length})
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {actionError && (
          <div className="attendance-board__error u-mb-16">
            <p>⚠ {actionError}</p>
          </div>
        )}

        {/* Request list */}
        <div className="approval-list-body">
          {filteredRequests.length === 0 ? (
            <div className="u-state-center-muted">
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
                isSelected={selectedIds.includes(request.id)}
                onToggleSelect={toggleSelect}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceApprovalDrawer;
