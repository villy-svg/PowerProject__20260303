# Phase 3.3 — Approval Drawer (Editor/Checker Flow)

## Skills Required (Read Before Starting)
- `rbac-security-system` §2 (Editor = Checker — UI guard required)
- `ui-design-system` §5 (Modal/Drawer overlay styling)
- `ui-design-system` §2 (`.halo-button` for all action buttons)
- `safe-code-modification` §2B (BEM class naming, no inline styles)
- `development-best-practices` §3 (try/catch on all async, toast on failure)

---

## Objective

Create `AttendanceApprovalDrawer.jsx` — the slide-in panel where editors review and act on pending edit requests.

### UX Flow
1. Editor sees the "Pending Approvals (N)" button in the header
2. Clicking opens this drawer from the right
3. Drawer shows all pending requests (or just requests for the selected cell if a cell was clicked)
4. Editor clicks Approve → calls `approveRequest()` → record upserted in `daily_attendances`
5. Editor clicks Reject → opens a note field → calls `rejectRequest()`

---

## Step 1: Create `AttendanceApprovalDrawer.jsx`

**File to create:**
```
src/verticals/Employees/attendance/AttendanceApprovalDrawer.jsx
```

**Full JSX Content:**

```jsx
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

// ---------------------------------------------------------------------------
// STATUS_LABELS: Human-readable labels for the suggested_status enum
// ---------------------------------------------------------------------------
const STATUS_LABELS = {
  'present':  '✅ Present',
  'week-off': '⬜ Week-Off',
  'leave':    '🟡 Leave',
  'absent':   '🔴 Absent',
};

// ---------------------------------------------------------------------------
// RequestCard — renders a single pending request with Approve/Reject actions
// ---------------------------------------------------------------------------
const RequestCard = ({ request, currentUserId, onApprove, onReject, isActing }) => {
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
    <div className="approval-card">
      {/* Employee Info */}
      <div className="approval-card__header">
        <div className="approval-card__employee">
          <p className="approval-card__name">{request.employees?.full_name}</p>
          {request.employees?.emp_code && (
            <span className="hub-badge">{request.employees.emp_code}</span>
          )}
        </div>
        <p className="approval-card__date">{formattedDate}</p>
      </div>

      {/* Suggested Change */}
      <div className="approval-card__change">
        <p className="approval-card__change-label">SUGGESTED STATUS</p>
        <p className="approval-card__change-value">
          {STATUS_LABELS[request.suggested_status] || request.suggested_status}
        </p>
        {request.suggested_shift_type && (
          <p className="approval-card__shift-type">
            Shift: {request.suggested_shift_type === 'day' ? '☀ Day' : '🌙 Night'}
          </p>
        )}
        {request.suggested_first_login_time && (
          <p className="approval-card__time">
            Login: {new Date(request.suggested_first_login_time).toLocaleTimeString('en-IN')}
          </p>
        )}
        {request.suggested_logout_time && (
          <p className="approval-card__time">
            Logout: {new Date(request.suggested_logout_time).toLocaleTimeString('en-IN')}
          </p>
        )}
      </div>

      {/* Requester Info */}
      <div className="approval-card__requester">
        <span className="approval-card__requester-label">Submitted by</span>
        <span className="approval-card__requester-name">{request.requester?.name || request.requester?.email}</span>
        <span className="approval-card__requester-time">
          {new Date(request.created_at).toLocaleString('en-IN')}
        </span>
      </div>

      {/* Action Buttons */}
      {!showRejectNote ? (
        <div className="approval-card__actions">
          <button
            className="halo-button approval-card__approve-btn"
            onClick={() => onApprove(request)}
            disabled={isActing}
            id={`approve-req-${request.id}`}
          >
            {isActing ? 'Applying…' : '✓ Approve'}
          </button>
          <button
            className="halo-button approval-card__reject-btn"
            onClick={() => setShowRejectNote(true)}
            disabled={isActing}
            id={`reject-req-${request.id}`}
          >
            ✕ Reject
          </button>
        </div>
      ) : (
        <div className="approval-card__reject-note-form">
          <label className="form-label" htmlFor={`reject-note-${request.id}`}>
            Rejection Reason (optional)
          </label>
          <textarea
            id={`reject-note-${request.id}`}
            className="approval-card__reject-textarea"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Explain the rejection to the contributor…"
            rows={3}
          />
          <div className="approval-card__actions">
            <button
              className="halo-button approval-card__reject-btn"
              onClick={handleRejectSubmit}
              disabled={isActing}
            >
              {isActing ? 'Rejecting…' : 'Confirm Reject'}
            </button>
            <button
              className="halo-button"
              onClick={() => setShowRejectNote(false)}
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
                currentUserId={currentUser?.id}
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
```

---

## Validation Checklist

- [ ] File created in `src/verticals/Employees/attendance/`
- [ ] `RequestCard` is a separate sub-component (not inlined in the main render)
- [ ] Approve action calls `approveRequest()` from `editRequestService.js` (not direct Supabase)
- [ ] Reject action shows a textarea first before confirming (prevents accidental rejections)
- [ ] All buttons use `.halo-button` class
- [ ] Backdrop overlay uses `onClick={onClose}` for click-outside-to-close
- [ ] `aria-modal="true"` and `role="dialog"` on the drawer `<aside>`
- [ ] `!!pendingRequests.length` used for the badge count (not raw number)
- [ ] `isActing` disables all action buttons during API call (prevents double-submit)
- [ ] Error state shown with a retry message

---

## DO NOT Proceed to Phase 3.4 Until All Items Above Are Checked.
