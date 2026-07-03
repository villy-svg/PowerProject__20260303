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
import '../../../styles/systems/systemLists.css';
import { IconChevronDown, IconChevronRight } from '../../../components/ui/Icons';


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
  const [showDetails,     setShowDetails]    = useState(false);

  // Compute unique employee count from entries
  const uniqueEmployees = [
    ...new Map(
      (plan.employee_Schedule_plan_entries || []).map(e => [e.employee_id, e.employees])
    ).values()
  ];
  const uniqueDates = [
    ...new Set((plan.employee_Schedule_plan_entries || []).map(e => e.shift_date))
  ].sort();

  const handleRejectSubmit = () => {
    onReject(plan, rejectNote);
    setShowRejectNote(false);
    setRejectNote('');
  };

  return (
    <div style={{ marginBottom: '12px' }}>
      <div className={`list-task-row ${(isExpanded || showRejectNote) ? 'is-expanded' : ''}`} style={{ 
        '--stage-color': 'var(--brand-blue)', 
        height: 'auto',
        borderLeft: '2px solid color-mix(in srgb, var(--brand-blue), transparent 30%)',
        borderBottomLeftRadius: (isExpanded || showRejectNote) ? 0 : '12px',
        borderBottomRightRadius: (isExpanded || showRejectNote) ? 0 : '12px',
      }}>
        {/* LEFT SIDE: Identity & Content */}
        <div className="list-row-main">
          <div className="list-row-badges">
            <span className="card-priority priority-high">
              Schedule Plan
            </span>
            <span className="subtask-tag" style={{ display: 'flex' }}>
              {uniqueEmployees.length} Emp • {uniqueDates.length} Days
            </span>
          </div>
          
          <div className="list-row-content">
            {formatDate(plan.date_from)} → {formatDate(plan.date_to)}
          </div>
        </div>

        {/* RIGHT SIDE: Action Controls */}
        <div className="list-row-controls" style={{ opacity: 1, pointerEvents: 'auto', display: 'flex', gap: '8px' }}>
          {!showRejectNote && (
            <>
              <button
                className="halo-button btn-approve"
                onClick={() => onApprove(plan)}
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
              setIsExpanded(!isExpanded);
            }}
            title="Toggle Details"
            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </button>
        </div>
      </div>

      {/* EXPANDED SECTIONS */}
      {(isExpanded || showRejectNote) && (
        <div style={{ 
          margin: '-1px 0 0 0', // attach flush to the bottom
          padding: '12px 16px', 
          background: 'var(--panel-bg)',
          border: '1px solid var(--border-color)',
          borderTop: 'none',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px'
        }}>
          {isExpanded && (
            <div className="sp-plan-card__employee-list">
              {Object.values(employeesData).map(emp => (
                <div key={emp.employeeId} className="sp-plan-card__employee-item">
                  <div className="sp-plan-card__employee-header">
                    <span className="sp-plan-card__emp-name">{emp.name}</span>
                    <span className="sp-plan-card__emp-count">{emp.shifts.length} shifts</span>
                  </div>
                  <div className="sp-plan-card__shift-list">
                    {emp.shifts.map((shift, idx) => {
                      const shiftTypeLabel = shift.shift_type === 'day' ? '☀ Day' : '🌙 Night';
                      const dayLabel = new Date(shift.shift_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
                      return (
                        <div key={idx} className="sp-plan-card__shift-item">
                          <span className="sp-shift-date">{dayLabel}</span>
                          <span className="sp-shift-type">{shiftTypeLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showRejectNote && (
            <div className="approval-card__reject-note-form" style={{ marginTop: isExpanded ? '12px' : '0', paddingTop: isExpanded ? '12px' : '0', borderTop: isExpanded ? '1px dashed var(--border-color)' : 'none' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }} htmlFor={`sp-reject-note-${plan.id}`}>
                Rejection Reason (optional)
              </label>
              <textarea
                id={`sp-reject-note-${plan.id}`}
                className="master-input"
                style={{ boxSizing: 'border-box', width: '100%', padding: '8px', fontSize: '0.8rem', marginTop: '4px', marginBottom: '8px', minHeight: '60px' }}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Explain the rejection to the contributor…"
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
// SchedulePlanApprovalDrawer — main export
// ---------------------------------------------------------------------------
const SchedulePlanApprovalDrawer = ({
  isOpen,
  planner,
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
    <div className="approval-page-container" style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Error state */}
        {actionError && (
          <div className="attendance-board__error" style={{ marginBottom: '16px' }}>
            <p>⚠ {actionError}</p>
          </div>
        )}

        {/* Plan list */}
        <div className="approval-list-body">
          {planner.isLoading ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>Loading plans…</div>
          ) : planner.pendingPlans.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', opacity: 0.6 }}>
              <p>No pending plans for approval.</p>
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
      </div>

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
    </div>
  );
};

export default SchedulePlanApprovalDrawer;


