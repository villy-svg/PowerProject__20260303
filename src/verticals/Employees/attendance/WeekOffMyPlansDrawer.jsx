/**
 * WeekOffMyPlansDrawer.jsx
 *
 * Drawer for Contributors to view their past week-off plans,
 * see rejection notes, and re-load rejected plans into the board for editing.
 */

import React from 'react';

// Format "2026-06-26" -> "26 Jun 2026"
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     className: 'wop-badge--draft'     },
  pending:   { label: 'Pending',   className: 'wop-badge--pending'   },
  approved:  { label: 'Approved',  className: 'wop-badge--approved'  },
  rejected:  { label: 'Rejected',  className: 'wop-badge--rejected'  },
  cancelled: { label: 'Cancelled', className: 'wop-badge--cancelled' },
};

const PlanStatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, className: '' };
  return <span className={`wop-badge ${cfg.className}`}>{cfg.label}</span>;
};

const WeekOffMyPlansDrawer = ({
  isOpen,
  planner,
  onClose,
  onLoadPlan,
}) => {
  if (!isOpen) return null;

  return (
    <div className="drawer-overlay" onClick={onClose} role="dialog">
      <div className="drawer drawer--right custom-scrollbar" onClick={(e) => e.stopPropagation()}>
        <div className="drawer__header">
          <h2 className="drawer__title">My Week Off Plans</h2>
          <button className="drawer__close-btn" onClick={onClose} aria-label="Close My Plans">
            ✕
          </button>
        </div>

        <div className="drawer__content">
          {planner.isLoading ? (
            <p className="drawer__empty-state">Loading your plans…</p>
          ) : planner.myPlans.length === 0 ? (
            <p className="drawer__empty-state">You haven't submitted any week-off plans yet.</p>
          ) : (
            <div className="wop-approval-list">
              {planner.myPlans.map((plan) => {
                const uniqueEmployeeIds = new Set(
                  (plan.employee_weekoff_plan_entries || []).map(e => e.employee_id)
                );
                const entryCount = plan.employee_weekoff_plan_entries?.length || 0;

                return (
                  <div key={plan.id} className="wop-approval-card">
                    <div className="wop-approval-card__header">
                      <div className="wop-approval-card__title">
                        {formatDate(plan.date_from)} → {formatDate(plan.date_to)}
                      </div>
                      <PlanStatusBadge status={plan.plan_status} />
                    </div>

                    <div className="wop-approval-card__meta">
                      {uniqueEmployeeIds.size} employees · {entryCount} total entries
                    </div>

                    {plan.review_note && plan.plan_status === 'rejected' && (
                      <div className="wop-approval-card__note">
                        <strong>Editor Note:</strong> {plan.review_note}
                      </div>
                    )}

                    {(plan.plan_status === 'rejected' || plan.plan_status === 'draft') && (
                      <div className="wop-approval-card__actions">
                        <button
                          className="halo-button halo-button--secondary"
                          onClick={() => onLoadPlan(plan)}
                        >
                          {plan.plan_status === 'rejected' ? '↩ Edit & Resubmit' : '✎ Continue Editing'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeekOffMyPlansDrawer;
