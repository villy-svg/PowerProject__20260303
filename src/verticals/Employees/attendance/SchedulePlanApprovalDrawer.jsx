/**
 * SchedulePlanApprovalDrawer.jsx
 *
 * Slide-in approval panel for Editors to review, approve, or reject
 * pending bulk Schedule plans submitted by Contributors or other Editors.
 *
 * Mirrors the pattern from AttendanceApprovalDrawer.jsx for consistency.
 * Uses the same .approval-drawer CSS classes (defined in EmployeeAttendanceBoard.css).
 *
 * Props:
 *   isOpen        {boolean}  - Controls visibility
 *   planner       {object}   - useSchedulePlanner hook result
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
import '../../../components/tasks/TaskCard.css';

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
      (plan.employee_Schedule_plan_entries || []).map(e => [e.employee_id, e.employees])
    ).values()
  ];
  const uniqueDates = [
    ...new Set((plan.employee_Schedule_plan_entries || []).map(e => e.shift_date))
  ].sort();
  const entryCount = plan.employee_Schedule_plan_entries?.length || 0;

  const handleRejectSubmit = () => {
    onReject(plan, rejectNote);
    setShowRejectNote(false);
    setRejectNote('');
  };

  return (
    <div className="task-card-master" style={{ '--stage-color': 'var(--brand-blue)', marginBottom: '12px' }}>
      {/* Row 1: Meta */}
      <div className="card-row-1">
        <span className="card-priority priority-high">
          Schedule Plan
        </span>
        <span className="subtask-tag">
          {uniqueEmployees.length} Emp • {uniqueDates.length} Days
        </span>
      </div>

      {/* Row 2: Title & Details */}
      <div className="card-row-2">
        <div className="card-row-2-title" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span className="card-task-name">
            {formatDate(plan.date_from)} → {formatDate(plan.date_to)}
          </span>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {entryCount} total entries
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Submitted by: {plan.submitter?.name || plan.submitter?.email || '—'}
          </div>
        </div>
      </div>

      {/* Employee List Toggle */}
      <div style={{ padding: '0 8px 8px 8px' }}>
        <button
          className="halo-button sp-plan-card__expand-btn"
          onClick={() => setIsExpanded(v => !v)}
          id={`sp-expand-plan-${plan.id}`}
          type="button"
        >
          {isExpanded ? '▲ Hide employees' : `▼ Show ${uniqueEmployees.length} employees`}
        </button>
        {isExpanded && (
          <div className="sp-plan-card__emp-list" style={{ marginTop: '8px' }}>
            {uniqueEmployees.map((emp, idx) => (
              <span key={emp?.id || idx} className="sp-plan-card__emp-chip">
                {emp?.full_name || '—'}
                {emp?.emp_code && <span className="hub-badge" style={{ marginLeft: '4px' }}>{emp.emp_code}</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {!showRejectNote ? (
        <div className="card-row-approval" style={{ padding: '8px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
          <button
            className="halo-button btn-approve"
            onClick={() => onApprove(plan)}
            disabled={isActing}
            id={`sp-approve-plan-${plan.id}`}
            style={{ flex: 1 }}
          >
            {isActing ? 'Applying…' : '✓ Approve'}
          </button>
          <button
            className="halo-button btn-reject"
            onClick={() => setShowRejectNote(true)}
            disabled={isActing}
            id={`sp-reject-plan-${plan.id}`}
            style={{ flex: 1 }}
          >
            ✕ Reject
          </button>
        </div>
      ) : (
        <div className="approval-card__reject-note-form" style={{ padding: '8px', borderTop: '1px solid var(--border-color)' }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }} htmlFor={`sp-reject-note-${plan.id}`}>
            Rejection Reason (optional)
          </label>
          <textarea
            id={`sp-reject-note-${plan.id}`}
            className="master-input"
            style={{ width: '100%', padding: '8px', fontSize: '0.8rem', marginTop: '4px', marginBottom: '8px', minHeight: '60px' }}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Explain the rejection to the contributor…"
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
// SchedulePlanApprovalDrawer — main export
// ---------------------------------------------------------------------------
const SchedulePlanApprovalDrawer = ({
  isOpen,
  planner,
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

    // Flatten entries into { employee_id, shift_date, attendance_status, hub_id } for the service
    const entries = (plan.employee_Schedule_plan_entries || []).map(e => ({
      employee_id:       e.employee_id,
      shift_date:        e.shift_date,
      attendance_status: e.attendance_status,
      hub_id:            e.hub_id,
    }));

    try {
      const { error } = await planner.approvePlan({
        planId:  plan.id,
        entries,
      });
      if (error) throw error;
      if (onActionComplete) onActionComplete();
    } catch (err) {
      console.error('[SchedulePlanApprovalDrawer] handleApprove error:', err);
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
      console.error('[SchedulePlanApprovalDrawer] handleReject error:', err);
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
        aria-label="Pending Schedule Plans"
      >
        <div className="approval-drawer__header">
          <h2 className="approval-drawer__title">
            Schedule Plans
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
            id="sp-approval-drawer-close"
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
              <p>No pending Schedule plans.</p>
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
        .sp-plan-card__expand-btn {
          font-size: 0.72rem;
          opacity: 0.6;
          align-self: flex-start;
          padding: 0.2rem 0.5rem;
        }
        .sp-plan-card__emp-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          padding: 0.5rem;
          background: var(--halo-bg);
          border-radius: var(--radius-button, 12px);
          border: 1px solid var(--border-color);
        }
        .sp-plan-card__emp-chip {
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

export default SchedulePlanApprovalDrawer;


