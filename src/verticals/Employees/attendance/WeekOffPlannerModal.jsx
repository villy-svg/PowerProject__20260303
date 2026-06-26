/**
 * WeekOffPlannerModal.jsx
 *
 * The main UI for Contributors and Editors to bulk-schedule week-offs.
 *
 * Features:
 *   - Date range picker (max 15 days from today)
 *   - Org-wide employee multi-select (Select All / Deselect All)
 *   - Plan summary card (N employees × M days)
 *   - "Save Draft" and "Submit for Approval" footer buttons
 *   - "My Plans" section — lists the user's own plans with status badges.
 *     Rejected plans show an "Edit & Resubmit" button that loads
 *     the plan's data back into the form.
 *
 * Props:
 *   user          {object}   - Current user object
 *   employees     {Array}    - All active org employees (from useAttendanceBoard)
 *   planner       {object}   - useWeekOffPlanner hook result
 *   onClose       {Function} - Closes the modal
 *   onPlanSaved   {Function} - Called after save/submit to refresh the board
 *
 * Skill compliance:
 *   ui-design-system §2      (halo-button for all actions)
 *   ui-design-system §1      (CSS variables only — no hardcoded hex)
 *   safe-code-modification §2B (BEM naming, no inline styles)
 *   rbac-security-system §2  (canSuggestEdit guard in parent; this component
 *                              only renders when guard passes)
 *   development-best-practices §3 (try/catch + submitError display)
 */

import React, { useState, useCallback, useMemo } from 'react';
import './WeekOffPlannerModal.css';

// ---------------------------------------------------------------------------
// Helper — format a 'YYYY-MM-DD' string to a readable locale string
// ---------------------------------------------------------------------------
function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Helper — get today's date as YYYY-MM-DD in IST
// ---------------------------------------------------------------------------
function todayIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

// ---------------------------------------------------------------------------
// Helper — get max allowed end date (today + 14 days) as YYYY-MM-DD
// ---------------------------------------------------------------------------
function maxEndDateIST() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

// ---------------------------------------------------------------------------
// PLAN STATUS BADGE CONFIG
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
  draft:     { label: 'Draft',     className: 'wop-badge--draft'     },
  pending:   { label: 'Pending',   className: 'wop-badge--pending'   },
  approved:  { label: 'Approved',  className: 'wop-badge--approved'  },
  rejected:  { label: 'Rejected',  className: 'wop-badge--rejected'  },
  cancelled: { label: 'Cancelled', className: 'wop-badge--cancelled' },
};

// ---------------------------------------------------------------------------
// PlanStatusBadge — inline status indicator
// ---------------------------------------------------------------------------
const PlanStatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, className: '' };
  return (
    <span className={`wop-badge ${cfg.className}`}>{cfg.label}</span>
  );
};

// ---------------------------------------------------------------------------
// PlanHistoryCard — renders one of the user's past plans
// ---------------------------------------------------------------------------
const PlanHistoryCard = ({ plan, onEditResubmit }) => {
  // Compute unique employee count for this plan
  const uniqueEmployeeIds = new Set(
    (plan.employee_weekoff_plan_entries || []).map(e => e.employee_id)
  );
  const entryCount = plan.employee_weekoff_plan_entries?.length || 0;

  return (
    <div className="wop-history-card">
      <div className="wop-history-card__header">
        <div className="wop-history-card__dates">
          <span className="wop-history-card__date-range">
            {formatDate(plan.date_from)} → {formatDate(plan.date_to)}
          </span>
          <PlanStatusBadge status={plan.plan_status} />
        </div>
        <span className="wop-history-card__meta">
          {uniqueEmployeeIds.size} employees · {entryCount} entries
        </span>
      </div>

      {/* Rejection note (if applicable) */}
      {plan.review_note && plan.plan_status === 'rejected' && (
        <div className="wop-history-card__rejection-note">
          <span className="wop-history-card__rejection-label">Editor Note:</span>
          <span>{plan.review_note}</span>
        </div>
      )}

      {/* Edit & Resubmit (rejected or draft plans) */}
      {(plan.plan_status === 'rejected' || plan.plan_status === 'draft') && (
        <button
          className="halo-button wop-history-card__edit-btn"
          onClick={() => onEditResubmit(plan)}
          id={`wop-edit-plan-${plan.id}`}
        >
          {plan.plan_status === 'rejected' ? '↩ Edit & Resubmit' : '✎ Continue Editing'}
        </button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// WeekOffPlannerModal — main export
// ---------------------------------------------------------------------------
const WeekOffPlannerModal = ({
  user,
  employees,
  planner,
  onClose,
  onPlanSaved,
}) => {
  const today      = todayIST();
  const maxEndDate = maxEndDateIST();

  // --- Form state ---
  const [activePlanId,      setActivePlanId]      = useState(null);   // null = new plan
  const [dateFrom,          setDateFrom]           = useState(today);
  const [dateTo,            setDateTo]             = useState(today);
  const [selectedEmployees, setSelectedEmployees]  = useState(
    () => new Set(employees.map(e => e.id))  // Default: all selected
  );
  const [isSubmitting,      setIsSubmitting]       = useState(false);
  const [submitError,       setSubmitError]        = useState(null);
  const [submitSuccess,     setSubmitSuccess]      = useState(null);
  const [showMyPlans,       setShowMyPlans]        = useState(false);

  // --- Derived: plan summary ---
  const dayCount = useMemo(() => {
    const from = new Date(dateFrom);
    const to   = new Date(dateTo);
    if (to < from) return 0;
    return Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
  }, [dateFrom, dateTo]);

  const entryCount = selectedEmployees.size * dayCount;

  // --- Toggle a single employee ---
  const toggleEmployee = useCallback((empId) => {
    setSelectedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(empId)) {
        next.delete(empId);
      } else {
        next.add(empId);
      }
      return next;
    });
  }, []);

  // --- Select / Deselect all ---
  const handleSelectAll = useCallback(() => {
    setSelectedEmployees(new Set(employees.map(e => e.id)));
  }, [employees]);

  const handleDeselectAll = useCallback(() => {
    setSelectedEmployees(new Set());
  }, []);

  // --- Load a rejected/draft plan into the form for re-editing ---
  const handleEditResubmit = useCallback((plan) => {
    setActivePlanId(plan.id);
    setDateFrom(plan.date_from);
    setDateTo(plan.date_to);
    const empIds = new Set(
      (plan.employee_weekoff_plan_entries || []).map(e => e.employee_id)
    );
    setSelectedEmployees(empIds);
    setShowMyPlans(false); // Switch back to the form
    setSubmitError(null);
    setSubmitSuccess(null);
  }, []);

  // --- Save Draft ---
  const handleSaveDraft = useCallback(async () => {
    if (selectedEmployees.size === 0) {
      setSubmitError('Please select at least one employee.');
      return;
    }
    if (dayCount === 0 || dayCount > 15) {
      setSubmitError('Date range must be between 1 and 15 days.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const { data, error } = await planner.saveDraft({
        planId:      activePlanId,
        dateFrom,
        dateTo,
        employeeIds: Array.from(selectedEmployees),
      });
      if (error) throw error;

      // If this was a new plan, update activePlanId so subsequent
      // "Submit" knows which plan to promote
      if (!activePlanId && data?.id) setActivePlanId(data.id);

      setSubmitSuccess('Draft saved. You can submit for approval when ready.');
      if (onPlanSaved) onPlanSaved();
    } catch (err) {
      console.error('[WeekOffPlannerModal] handleSaveDraft error:', err);
      setSubmitError(err?.message || 'Failed to save draft. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [activePlanId, dateFrom, dateTo, selectedEmployees, dayCount, planner, onPlanSaved]);

  // --- Submit for Approval ---
  const handleSubmitForApproval = useCallback(async () => {
    if (selectedEmployees.size === 0) {
      setSubmitError('Please select at least one employee.');
      return;
    }
    if (dayCount === 0 || dayCount > 15) {
      setSubmitError('Date range must be between 1 and 15 days.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      // Step 1: Always save/update the draft first to ensure entries are fresh
      const { data: draftData, error: draftErr } = await planner.saveDraft({
        planId:      activePlanId,
        dateFrom,
        dateTo,
        employeeIds: Array.from(selectedEmployees),
      });
      if (draftErr) throw draftErr;

      const resolvedPlanId = activePlanId || draftData?.id;
      if (!resolvedPlanId) throw new Error('Failed to resolve plan ID after save.');

      // Step 2: Submit (transitions draft → pending, cancels overlapping pending)
      const { error: submitErr } = await planner.submitPlan({
        planId:   resolvedPlanId,
        dateFrom,
        dateTo,
      });
      if (submitErr) throw submitErr;

      setSubmitSuccess(
        `Plan submitted! ${entryCount} week-off entries are pending Editor approval.`
      );
      setActivePlanId(null); // Reset form to "new plan" state after submission
      if (onPlanSaved) onPlanSaved();
    } catch (err) {
      console.error('[WeekOffPlannerModal] handleSubmitForApproval error:', err);
      setSubmitError(err?.message || 'Failed to submit plan. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [activePlanId, dateFrom, dateTo, selectedEmployees, dayCount, entryCount, planner, onPlanSaved]);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-body wop-modal"
        onClick={(e) => e.stopPropagation()}
        aria-label="Week Off Planner"
      >
        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Week Off Planner</h2>
            <p className="modal-subtitle">
              Schedule week-offs for all employees up to 15 days ahead.
            </p>
          </div>
          <button
            className="halo-button modal-close-btn"
            onClick={onClose}
            id="wop-modal-close"
            aria-label="Close Week Off Planner"
          >
            ✕
          </button>
        </div>

        {/* ── INFO BANNER ─────────────────────────────────────────────────── */}
        <div className="wop-modal__info-banner">
          <p>
            <strong>Contributors</strong> can save drafts and submit plans for approval. &nbsp;
            <strong>Editors</strong> can approve or reject submitted plans in bulk.
            Once approved, individual dates follow the standard single-cell edit flow.
          </p>
        </div>

        {/* ── TAB TOGGLE ─────────────────────────────────────────────────── */}
        <div className="wop-modal__tabs">
          <button
            className={`halo-button wop-modal__tab ${!showMyPlans ? 'wop-modal__tab--active' : ''}`}
            onClick={() => setShowMyPlans(false)}
            id="wop-tab-new"
          >
            New Plan
          </button>
          <button
            className={`halo-button wop-modal__tab ${showMyPlans ? 'wop-modal__tab--active' : ''}`}
            onClick={() => setShowMyPlans(true)}
            id="wop-tab-history"
          >
            My Plans
            {planner.myPlans.length > 0 && (
              <span className="wop-modal__tab-badge">{planner.myPlans.length}</span>
            )}
          </button>
        </div>

        {/* ── MY PLANS PANEL ─────────────────────────────────────────────── */}
        {showMyPlans ? (
          <div className="wop-modal__my-plans custom-scrollbar">
            {planner.isLoading ? (
              <div className="wop-modal__loading">Loading plans…</div>
            ) : planner.myPlans.length === 0 ? (
              <div className="wop-modal__empty">No plans yet. Create your first plan.</div>
            ) : (
              planner.myPlans.map(plan => (
                <PlanHistoryCard
                  key={plan.id}
                  plan={plan}
                  onEditResubmit={handleEditResubmit}
                />
              ))
            )}
          </div>
        ) : (
          /* ── NEW PLAN FORM ───────────────────────────────────────────── */
          <div className="wop-modal__form custom-scrollbar">

            {/* Active plan indicator (editing a draft/rejected) */}
            {activePlanId && (
              <div className="wop-modal__edit-indicator">
                <span>Editing an existing plan</span>
                <button
                  className="halo-button wop-modal__clear-plan-btn"
                  onClick={() => {
                    setActivePlanId(null);
                    setDateFrom(today);
                    setDateTo(today);
                    setSelectedEmployees(new Set(employees.map(e => e.id)));
                    setSubmitError(null);
                    setSubmitSuccess(null);
                  }}
                  id="wop-clear-plan"
                >
                  × Start New
                </button>
              </div>
            )}

            {/* Date Range */}
            <div className="wop-modal__date-row">
              <div className="form-group wop-modal__date-group">
                <label className="form-label" htmlFor="wop-date-from">FROM DATE</label>
                <div className="form-input-container">
                  <input
                    id="wop-date-from"
                    type="date"
                    className="form-input"
                    value={dateFrom}
                    min={today}
                    max={dateTo || maxEndDate}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
              </div>
              <div className="wop-modal__date-arrow">→</div>
              <div className="form-group wop-modal__date-group">
                <label className="form-label" htmlFor="wop-date-to">TO DATE</label>
                <div className="form-input-container">
                  <input
                    id="wop-date-to"
                    type="date"
                    className="form-input"
                    value={dateTo}
                    min={dateFrom || today}
                    max={maxEndDate}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* 15-day cap warning */}
            {dayCount > 15 && (
              <p className="wop-modal__date-warning">
                ⚠ Range exceeds 15 days. Please shorten the period.
              </p>
            )}

            {/* Employee Selector */}
            <div className="form-group">
              <div className="wop-modal__emp-header">
                <label className="form-label">
                  EMPLOYEES ({selectedEmployees.size} / {employees.length} selected)
                </label>
                <div className="wop-modal__emp-bulk-btns">
                  <button
                    className="halo-button wop-modal__bulk-btn"
                    onClick={handleSelectAll}
                    id="wop-select-all"
                    type="button"
                  >
                    All
                  </button>
                  <button
                    className="halo-button wop-modal__bulk-btn"
                    onClick={handleDeselectAll}
                    id="wop-deselect-all"
                    type="button"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="wop-modal__emp-list custom-scrollbar">
                {employees.map(emp => (
                  <label
                    key={emp.id}
                    className={`wop-modal__emp-item ${selectedEmployees.has(emp.id) ? 'wop-modal__emp-item--selected' : ''}`}
                    htmlFor={`wop-emp-${emp.id}`}
                  >
                    <input
                      id={`wop-emp-${emp.id}`}
                      type="checkbox"
                      className="wop-modal__emp-checkbox"
                      checked={selectedEmployees.has(emp.id)}
                      onChange={() => toggleEmployee(emp.id)}
                    />
                    <span className="wop-modal__emp-name">{emp.full_name}</span>
                    {emp.emp_code && (
                      <span className="hub-badge wop-modal__emp-code">{emp.emp_code}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Plan Summary */}
            <div className="wop-modal__summary">
              <span className="wop-modal__summary-label">PLAN SUMMARY</span>
              <span className="wop-modal__summary-value">
                {selectedEmployees.size === 0 || dayCount === 0
                  ? 'No entries — select employees and a date range.'
                  : `${selectedEmployees.size} employee${selectedEmployees.size !== 1 ? 's' : ''} × ${dayCount} day${dayCount !== 1 ? 's' : ''} = ${entryCount} week-off entries`
                }
              </span>
            </div>

            {/* Error / Success feedback */}
            {submitError && (
              <div className="wop-modal__error">
                <p>⚠ {submitError}</p>
              </div>
            )}
            {submitSuccess && (
              <div className="wop-modal__success">
                <p>✓ {submitSuccess}</p>
              </div>
            )}

            {/* Footer */}
            <div className="modal-footer">
              <button
                type="button"
                className="halo-button"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Close
              </button>
              <button
                type="button"
                className="halo-button wop-modal__draft-btn"
                onClick={handleSaveDraft}
                disabled={isSubmitting || selectedEmployees.size === 0 || dayCount === 0 || dayCount > 15}
                id="wop-save-draft"
              >
                {isSubmitting ? 'Saving…' : '💾 Save Draft'}
              </button>
              <button
                type="button"
                className="halo-button wop-modal__submit-btn"
                onClick={handleSubmitForApproval}
                disabled={isSubmitting || selectedEmployees.size === 0 || dayCount === 0 || dayCount > 15}
                id="wop-submit"
              >
                {isSubmitting ? 'Submitting…' : '→ Submit for Approval'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeekOffPlannerModal;
