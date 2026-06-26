/**
 * WeekOffPlanApprovalDrawer.jsx
 *
 * Slide-in approval panel for Editors to review, approve, or reject
 * pending bulk week-off plans submitted by Contributors or other Editors.
 *
 * Mirrors the pattern from AttendanceApprovalDrawer.jsx for consistency.
 * Uses the same .approval-drawer CSS classes (defined in EmployeeAttendanceBoard.css).
 *
 * Props:
 *   isOpen        {boolean}  - Controls visibility
 *   planner       {object}   - useWeekOffPlanner hook result
 *   currentUser   {object}   - The logged-in user object
 *   onClose       {Function} - Closes the drawer
 *   onActionComplete {Function} - Called after approve/reject to refresh board
 *
 * Skill compliance:
 *   rbac-security-system §2   (Editor guard in parent Board Shell)
 *   ui-design-system §5       (Overlay/Drawer pattern)
 *   ui-design-system §2       (halo-button for all actions)
 *   safe-code-modification §2B (BEM naming, no inline styles)
 *   development-best-practices §3 (try/catch + error display)
 */

import React, { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Helper — format a 'YYYY-MM-DD' string to readable locale
// ---------------------------------------------------------------------------
function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// PlanCard — renders a single pending plan with Approve/Reject actions
// ---------------------------------------------------------------------------
const PlanCard = ({ plan, onApprove, onReject, isActing }) => {
  const [showRejectNote,  setShowRejectNote] = useState(false);
  const [rejectNote,      setRejectNote]     = useState('');
  const [isExpanded,      setIsExpanded]     = useState(false);

  // Compute unique employee count from entries
  const uniqueEmployees = [
    ...new Map(
      (plan.employee_weekoff_plan_entries || []).map(e => [e.employee_id, e.employees])
    ).values()
  ];
  const uniqueDates = [
    ...new Set((plan.employee_weekoff_plan_entries || []).map(e => e.shift_date))
  ].sort();
  const entryCount = plan.employee_weekoff_plan_entries?.length || 0;

  const handleRejectSubmit = () => {
    onReject(plan, rejectNote);
    setShowRejectNote(false);
    setRejectNote('');
  };

  return (
    <div className="approval-card">
      {/* Plan summary header */}
      <div className="approval-card__header">
        <div className="approval-card__employee">
          <p className="approval-card__name">
            {formatDate(plan.date_from)} → {formatDate(plan.date_to)}
          </p>
        </div>
        <p className="approval-card__date">
          {uniqueEmployees.length} employees · {uniqueDates.length} days · {entryCount} entries
        </p>
      </div>

      {/* Submitter info */}
      <div className="approval-card__requester">
        <span className="approval-card__requester-label">Submitted by</span>
        <span className="approval-card__requester-name">
          {plan.submitter?.name || plan.submitter?.email || '—'}
        </span>
        <span className="approval-card__requester-time">
          {new Date(plan.created_at).toLocaleString('en-IN')}
        </span>
      </div>

      {/* Expandable employee list */}
      <button
        className="halo-button wop-plan-card__expand-btn"
        onClick={() => setIsExpanded(v => !v)}
        id={`wop-expand-plan-${plan.id}`}
        type="button"
      >
        {isExpanded ? '▲ Hide employees' : `▼ Show ${uniqueEmployees.length} employees`}
      </button>

      {isExpanded && (
        <div className="wop-plan-card__emp-list">
          {uniqueEmployees.map(emp => (
            <span key={emp?.id || Math.random()} className="wop-plan-card__emp-chip">
              {emp?.full_name || '—'}
              {emp?.emp_code && <span className="hub-badge">{emp.emp_code}</span>}
            </span>
          ))}
        </div>
      )}

      {/* Action Buttons / Rejection Note */}
      {!showRejectNote ? (
        <div className="approval-card__actions">
          <button
            className="halo-button approval-card__approve-btn"
            onClick={() => onApprove(plan)}
            disabled={isActing}
            id={`wop-approve-plan-${plan.id}`}
          >
            {isActing ? 'Applying…' : '✓ Approve Plan'}
          </button>
          <button
            className="halo-button approval-card__reject-btn"
            onClick={() => setShowRejectNote(true)}
            disabled={isActing}
            id={`wop-reject-plan-${plan.id}`}
          >
            ✕ Reject
          </button>
        </div>
      ) : (
        <div className="approval-card__reject-note-form">
          <label className="form-label" htmlFor={`wop-reject-note-${plan.id}`}>
            Rejection Reason (optional)
          </label>
          <textarea
            id={`wop-reject-note-${plan.id}`}
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
// WeekOffPlanApprovalDrawer — main export
// ---------------------------------------------------------------------------
const WeekOffPlanApprovalDrawer = ({
  isOpen,
  planner,
  currentUser,
  onClose,
  onActionComplete,
}) => {
  const [isActing,     setIsActing]    = useState(false);
  const [actionError,  setActionError] = useState(null);

  // ---------------------------------------------------------------------------
  // Approve handler
  // ---------------------------------------------------------------------------
  const handleApprove = useCallback(async (plan) => {
    setIsActing(true);
    setActionError(null);

    // Flatten entries into { employee_id, shift_date } for the service
    const entries = (plan.employee_weekoff_plan_entries || []).map(e => ({
      employee_id: e.employee_id,
      shift_date:  e.shift_date,
    }));

    try {
      const { error } = await planner.approvePlan({
        planId:  plan.id,
        entries,
      });
      if (error) throw error;
      if (onActionComplete) onActionComplete();
    } catch (err) {
      console.error('[WeekOffPlanApprovalDrawer] handleApprove error:', err);
      setActionError(err?.message || 'Failed to approve plan. Please try again.');
    } finally {
      setIsActing(false);
    }
  }, [planner, onActionComplete]);

  // ---------------------------------------------------------------------------
  // Reject handler
  // ---------------------------------------------------------------------------
  const handleReject = useCallback(async (plan, reviewNote) => {
    setIsActing(true);
    setActionError(null);

    try {
      const { error } = await planner.rejectPlan({
        planId:     plan.id,
        reviewNote,
      });
      if (error) throw error;
      if (onActionComplete) onActionComplete();
    } catch (err) {
      console.error('[WeekOffPlanApprovalDrawer] handleReject error:', err);
      setActionError(err?.message || 'Failed to reject plan. Please try again.');
    } finally {
      setIsActing(false);
    }
  }, [planner, onActionComplete]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay (ui-design-system §5) */}
      <div
        className="approval-drawer__backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel — reuses approval-drawer CSS from EmployeeAttendanceBoard.css */}
      <aside
        className="approval-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Pending Week-Off Plans"
      >
        <div className="approval-drawer__header">
          <h2 className="approval-drawer__title">
            Week-Off Plans
            {!!planner.pendingPlansCount && (
              <span className="attendance-board__pending-badge">
                {planner.pendingPlansCount}
              </span>
            )}
          </h2>
          <button
            className="halo-button approval-drawer__close-btn"
            onClick={onClose}
            aria-label="Close plan approval drawer"
            id="wop-approval-drawer-close"
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

        {/* Plan list */}
        <div className="approval-drawer__body custom-scrollbar">
          {planner.isLoading ? (
            <div className="approval-drawer__empty">Loading plans…</div>
          ) : planner.pendingPlans.length === 0 ? (
            <div className="approval-drawer__empty">
              <p>No pending week-off plans.</p>
            </div>
          ) : (
            planner.pendingPlans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onApprove={handleApprove}
                onReject={handleReject}
                isActing={isActing}
              />
            ))
          )}
        </div>
      </aside>

      {/* Scoped styles for plan-specific additions (extends existing approval-card CSS) */}
      <style>{`
        .wop-plan-card__expand-btn {
          font-size: 0.72rem;
          opacity: 0.6;
          align-self: flex-start;
          padding: 0.2rem 0.5rem;
        }
        .wop-plan-card__emp-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          padding: 0.5rem;
          background: var(--halo-bg);
          border-radius: var(--radius-button, 12px);
          border: 1px solid var(--border-color);
        }
        .wop-plan-card__emp-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.2rem 0.6rem;
          background: color-mix(in srgb, var(--text-color), transparent 90%);
          border-radius: 99px;
          font-size: 0.72rem;
          font-weight: 500;
        }
      `}</style>
    </>
  );
};

export default WeekOffPlanApprovalDrawer;
