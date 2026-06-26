/**
 * WeekOffPlannerModal.jsx
 *
 * The main UI for Contributors and Editors to bulk-schedule week-offs.
 * Redesigned for per-employee week-based selection.
 *
 * Features:
 *   - Week selector (e.g., 2026-W34)
 *   - Org-wide employee list with 2 date pickers per employee
 *   - Date pickers show the day of the week and are restricted to the selected week
 *   - "Save Draft" and "Submit for Approval" footer buttons
 *   - "My Plans" section
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
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import './WeekOffPlannerModal.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// Format "2026-06-26" -> "Mon, 26 Jun"
function formatDateWithDay(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short'
  });
}

// Get the Monday of the current week (ISO 8601 week starts on Monday)
function getCurrentWeekString() {
  const now = new Date();
  const day = now.getDay() || 7; // Sunday is 0 -> 7
  now.setDate(now.getDate() - day + 1); // Monday
  const year = now.getFullYear();
  
  // Calculate ISO week number
  const target = new Date(now.valueOf());
  const dayNr = (now.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

// Convert "YYYY-Www" to { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } (Monday to Sunday)
function getDatesFromWeekString(weekStr) {
  if (!weekStr) return { from: '', to: '' };
  const [year, week] = weekStr.split('-W');
  
  // Create a date for Jan 1 of the year
  const date = new Date(year, 0, 1);
  const days = (week - 1) * 7;
  
  // ISO weeks start on Monday, so adjust if Jan 1 is not a Monday
  const dayOffset = date.getDay() <= 4 && date.getDay() !== 0 ? date.getDay() - 1 : date.getDay() + 6;
  date.setDate(date.getDate() - dayOffset + days);
  
  const fromStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
  
  const toDate = new Date(date);
  toDate.setDate(toDate.getDate() + 6);
  const toStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(toDate);
  
  return { from: fromStr, to: toStr };
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

const PlanStatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, className: '' };
  return <span className={`wop-badge ${cfg.className}`}>{cfg.label}</span>;
};

// ---------------------------------------------------------------------------
// PlanHistoryCard
// ---------------------------------------------------------------------------
const PlanHistoryCard = ({ plan, onEditResubmit }) => {
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

      {plan.review_note && plan.plan_status === 'rejected' && (
        <div className="wop-history-card__rejection-note">
          <span className="wop-history-card__rejection-label">Editor Note:</span>
          <span>{plan.review_note}</span>
        </div>
      )}

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
  // --- Form state ---
  const [activePlanId,  setActivePlanId]  = useState(null);
  const [weekString,    setWeekString]    = useState(getCurrentWeekString());
  
  // Map of employeeId -> [date1, date2]
  const [employeeSelections, setEmployeeSelections] = useState({});
  
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [submitError,   setSubmitError]   = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [showMyPlans,   setShowMyPlans]   = useState(false);

  const { from: dateFrom, to: dateTo } = useMemo(() => getDatesFromWeekString(weekString), [weekString]);

  // Total entries calculation
  const totalEntries = useMemo(() => {
    let count = 0;
    Object.values(employeeSelections).forEach(dates => {
      if (dates[0]) count++;
      if (dates[1]) count++;
    });
    return count;
  }, [employeeSelections]);

  const activeEmployeesCount = useMemo(() => {
    return Object.values(employeeSelections).filter(dates => dates[0] || dates[1]).length;
  }, [employeeSelections]);

  // --- Date change handler ---
  const handleDateChange = useCallback((empId, index, newDate) => {
    setEmployeeSelections(prev => {
      const currentDates = prev[empId] || ['', ''];
      const updatedDates = [...currentDates];
      updatedDates[index] = newDate;
      return { ...prev, [empId]: updatedDates };
    });
  }, []);

  // --- Load a rejected/draft plan into the form for re-editing ---
  const handleEditResubmit = useCallback((plan) => {
    setActivePlanId(plan.id);
    
    // We don't have the original weekString, but we have date_from (a Monday).
    // Let's manually reconstruct the week string. Or just set a custom week if needed.
    // To be safe, we calculate it from date_from.
    const d = new Date(plan.date_from);
    const year = d.getFullYear();
    const firstThursday = new Date(d.getFullYear(), 0, 4);
    const days = Math.round((d.getTime() - firstThursday.getTime()) / 86400000);
    const weekNumber = 1 + Math.ceil(days / 7);
    setWeekString(`${year}-W${weekNumber.toString().padStart(2, '0')}`);

    // Rehydrate selections
    const newSelections = {};
    const entries = plan.employee_weekoff_plan_entries || [];
    entries.forEach(entry => {
      if (!newSelections[entry.employee_id]) {
        newSelections[entry.employee_id] = [entry.shift_date, ''];
      } else if (!newSelections[entry.employee_id][1]) {
        newSelections[entry.employee_id][1] = entry.shift_date;
      }
    });
    setEmployeeSelections(newSelections);

    setShowMyPlans(false);
    setSubmitError(null);
    setSubmitSuccess(null);
  }, []);

  // --- Generate Payload ---
  const buildPayload = useCallback(() => {
    return Object.keys(employeeSelections).map(empId => ({
      employeeId: empId,
      dates: employeeSelections[empId]
    })).filter(sel => sel.dates[0] || sel.dates[1]);
  }, [employeeSelections]);

  // --- Save Draft ---
  const handleSaveDraft = useCallback(async () => {
    if (totalEntries === 0) {
      setSubmitError('Please assign at least one date to an employee.');
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
        employeeSelections: buildPayload(),
      });
      if (error) throw error;

      if (!activePlanId && data?.id) setActivePlanId(data.id);
      setSubmitSuccess('Draft saved. You can submit for approval when ready.');
      if (onPlanSaved) onPlanSaved();
    } catch (err) {
      console.error('[WeekOffPlannerModal] handleSaveDraft error:', err);
      setSubmitError(err?.message || 'Failed to save draft. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [activePlanId, dateFrom, dateTo, totalEntries, buildPayload, planner, onPlanSaved]);

  // --- Submit for Approval ---
  const handleSubmitForApproval = useCallback(async () => {
    if (totalEntries === 0) {
      setSubmitError('Please assign at least one date to an employee.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const { data: draftData, error: draftErr } = await planner.saveDraft({
        planId:      activePlanId,
        dateFrom,
        dateTo,
        employeeSelections: buildPayload(),
      });
      if (draftErr) throw draftErr;

      const resolvedPlanId = activePlanId || draftData?.id;
      if (!resolvedPlanId) throw new Error('Failed to resolve plan ID after save.');

      const { error: submitErr } = await planner.submitPlan({
        planId:   resolvedPlanId,
        dateFrom,
        dateTo,
      });
      if (submitErr) throw submitErr;

      setSubmitSuccess(
        `Plan submitted! ${totalEntries} week-off entries are pending Editor approval.`
      );
      setActivePlanId(null);
      if (onPlanSaved) onPlanSaved();
    } catch (err) {
      console.error('[WeekOffPlannerModal] handleSubmitForApproval error:', err);
      setSubmitError(err?.message || 'Failed to submit plan. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [activePlanId, dateFrom, dateTo, totalEntries, buildPayload, planner, onPlanSaved]);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-body wop-modal wop-modal--wide"
        onClick={(e) => e.stopPropagation()}
        aria-label="Week Off Planner"
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Week Off Planner</h2>
            <p className="modal-subtitle">
              Schedule up to 2 days off per employee for a specific week.
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

        <div className="wop-modal__tabs">
          <button
            className={`halo-button wop-modal__tab ${!showMyPlans ? 'wop-modal__tab--active' : ''}`}
            onClick={() => setShowMyPlans(false)}
          >
            New Plan
          </button>
          <button
            className={`halo-button wop-modal__tab ${showMyPlans ? 'wop-modal__tab--active' : ''}`}
            onClick={() => setShowMyPlans(true)}
          >
            My Plans
            {planner.myPlans.length > 0 && (
              <span className="wop-modal__tab-badge">{planner.myPlans.length}</span>
            )}
          </button>
        </div>

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
          <div className="wop-modal__form custom-scrollbar">

            {activePlanId && (
              <div className="wop-modal__edit-indicator">
                <span>Editing an existing plan</span>
                <button
                  className="halo-button wop-modal__clear-plan-btn"
                  onClick={() => {
                    setActivePlanId(null);
                    setWeekString(getCurrentWeekString());
                    setEmployeeSelections({});
                    setSubmitError(null);
                    setSubmitSuccess(null);
                  }}
                >
                  × Start New
                </button>
              </div>
            )}

            {/* Week Selector */}
            <div className="form-group wop-modal__week-group">
              <label className="form-label" htmlFor="wop-week-select">TARGET WEEK</label>
              <div className="form-input-container">
                <input
                  id="wop-week-select"
                  type="week"
                  className="form-input wop-modal__week-input"
                  value={weekString}
                  onChange={(e) => setWeekString(e.target.value)}
                  required
                />
              </div>
              <p className="wop-modal__week-hint">
                Covers: {formatDate(dateFrom)} to {formatDate(dateTo)}
              </p>
            </div>

            {/* Employee List with specific Date Pickers */}
            <div className="wop-modal__emp-grid-container">
              <div className="wop-modal__emp-grid-header">
                <div className="wop-modal__grid-col-name">EMPLOYEE</div>
                <div className="wop-modal__grid-col-date">DATE 1</div>
                <div className="wop-modal__grid-col-date">DATE 2</div>
              </div>
              
              <div className="wop-modal__emp-grid-body custom-scrollbar">
                {employees.map(emp => {
                  const selections = employeeSelections[emp.id] || ['', ''];
                  return (
                    <div key={emp.id} className="wop-modal__emp-grid-row">
                      <div className="wop-modal__grid-col-name">
                        <span className="wop-modal__emp-name">{emp.full_name}</span>
                        {emp.emp_code && (
                          <span className="hub-badge wop-modal__emp-code">{emp.emp_code}</span>
                        )}
                      </div>
                      
                      {/* Date 1 Picker */}
                      <div className="wop-modal__grid-col-date">
                        <div className="wop-modal__date-input-wrapper">
                          <input
                            type="date"
                            className="form-input wop-modal__date-input"
                            value={selections[0]}
                            min={dateFrom}
                            max={dateTo}
                            onChange={(e) => handleDateChange(emp.id, 0, e.target.value)}
                          />
                          {selections[0] && (
                            <span className="wop-modal__day-label">
                              {formatDateWithDay(selections[0]).split(',')[0]}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Date 2 Picker */}
                      <div className="wop-modal__grid-col-date">
                        <div className="wop-modal__date-input-wrapper">
                          <input
                            type="date"
                            className="form-input wop-modal__date-input"
                            value={selections[1]}
                            min={dateFrom}
                            max={dateTo}
                            onChange={(e) => handleDateChange(emp.id, 1, e.target.value)}
                          />
                          {selections[1] && (
                            <span className="wop-modal__day-label">
                              {formatDateWithDay(selections[1]).split(',')[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Plan Summary */}
            <div className="wop-modal__summary">
              <span className="wop-modal__summary-label">PLAN SUMMARY</span>
              <span className="wop-modal__summary-value">
                {totalEntries === 0
                  ? 'No dates assigned yet.'
                  : `${totalEntries} entries across ${activeEmployeesCount} employees`
                }
              </span>
            </div>

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
                disabled={isSubmitting || totalEntries === 0}
              >
                {isSubmitting ? 'Saving…' : '💾 Save Draft'}
              </button>
              <button
                type="button"
                className="halo-button wop-modal__submit-btn"
                onClick={handleSubmitForApproval}
                disabled={isSubmitting || totalEntries === 0}
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
