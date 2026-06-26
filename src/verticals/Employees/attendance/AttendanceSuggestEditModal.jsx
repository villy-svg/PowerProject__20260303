/**
 * AttendanceSuggestEditModal.jsx
 *
 * Modal for Contributors (Makers) to suggest an edit to an attendance record.
 * Creates a pending row in attendance_edit_requests. Does NOT modify
 * daily_attendances directly.
 *
 * Props:
 *   selectedCell     - { employeeId, date, record } from the Board Shell
 *   currentUser      - The logged-in user object
 *   onClose          - Function() → closes the modal
 *   onSubmitComplete - Function() → called after successful submission
 *
 * Skill compliance:
 *   rbac-security-system §2 (Guard in parent — this component only renders for contributors)
 *   ui-design-system §5 (Modal overlay pattern)
 *   ui-design-system §9 (Block-in-a-Box form styling — .form-group / .form-input-container)
 *   ui-design-system §10 (Master Dropdown for status select)
 *   safe-code-modification §2B (BEM naming, no inline styles)
 */

import React, { useState } from 'react';
import { submitEditRequest } from '../../../services/employees/editRequestService';
import CustomSelect from '../../../components/ui/CustomSelect';

// ---------------------------------------------------------------------------
// STATUS_OPTIONS: The selectable statuses for the suggestion form.
// Presentational helpers avoid mixing display logic with data logic.
// ---------------------------------------------------------------------------
const STATUS_OPTIONS = [
  { value: 'present',  label: 'Present'  },
  { value: 'week-off', label: 'Week-Off' },
  { value: 'leave',    label: 'Leave'    },
  { value: 'absent',   label: 'Absent'   },
  { value: 'no-show',  label: 'No Show'  },
  { value: 'no-call-no-show', label: 'No Call No Show' },
];

const SHIFT_TYPE_OPTIONS = [
  { value: '',      label: '— None —'  },
  { value: 'day',   label: '☀ Day'   },
  { value: 'night', label: '🌙 Night' },
];

const AttendanceSuggestEditModal = ({
  selectedCell,
  currentUser,
  onClose,
  onSubmitComplete,
}) => {
  const { employeeId, date, record, employeeName } = selectedCell || {};

  // Form state — default to the existing record's values if available
  const initialStatus = (record?.attendance_status && record.attendance_status !== 'null') 
    ? record.attendance_status 
    : 'present';
    
  const [suggestedStatus, setSuggestedStatus] = useState(initialStatus);
  const [suggestedShiftType, setSuggestedShiftType] = useState(
    record?.shift_type || ''
  );

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Formatted date for display
  const displayDate = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      })
    : '';

  // ---------------------------------------------------------------------------
  // Submit handler — creates a pending edit request
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    let finalLoginTime = null;
    let finalLogoutTime = null;

    if (suggestedStatus === 'present') {
      if (suggestedShiftType === 'day') {
        finalLoginTime = `${date}T10:00`;
        finalLogoutTime = `${date}T20:00`;
      } else if (suggestedShiftType === 'night') {
        finalLoginTime = `${date}T22:00`;
        
        const nextDay = new Date(date + 'T00:00:00');
        nextDay.setDate(nextDay.getDate() + 1);
        const yyyy = nextDay.getFullYear();
        const mm = String(nextDay.getMonth() + 1).padStart(2, '0');
        const dd = String(nextDay.getDate()).padStart(2, '0');
        const nextDateStr = `${yyyy}-${mm}-${dd}`;
        
        finalLogoutTime = `${nextDateStr}T08:00`;
      }
    }

    try {
      const { error } = await submitEditRequest({
        employeeId,
        shiftDate:               date,
        suggestedStatus,
        suggestedShiftType:      suggestedShiftType || null,
        suggestedFirstLoginTime: finalLoginTime,
        suggestedLogoutTime:     finalLogoutTime,
        // Link to existing record if it exists (null for future dates)
        dailyAttendanceId:       record?.id || null,
        requestedBy:             currentUser?.id,
      });

      if (error) throw error;

      onSubmitComplete();
    } catch (err) {
      console.error('[AttendanceSuggestEditModal] handleSubmit error:', err);
      setSubmitError(err?.message || 'Failed to submit suggestion. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    /* Modal overlay (ui-design-system §5) */
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      {/* Stop click propagation so clicking inside the modal doesn't close it */}
      <div
        className="modal-body suggest-edit-modal"
        onClick={(e) => e.stopPropagation()}
        aria-label="Suggest attendance edit"
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Edit Attendance</h2>
            <p className="modal-subtitle">{employeeName} • {displayDate}</p>
          </div>
          <button
            className="halo-button modal-close-btn"
            onClick={onClose}
            id="suggest-edit-modal-close"
            aria-label="Close suggest edit modal"
          >
            ✕
          </button>
        </div>



        {/* Current Status (read-only context) */}
        {record?.attendance_status && (
          <div className="form-group">
            <label className="form-label">CURRENT STATUS</label>
            <div className="form-input-container suggest-edit-modal__current-status">
              <span>{record.attendance_status.toUpperCase()}</span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="suggest-edit-modal__form">

          {/* Suggested Status — using Master Dropdown (ui-design-system §10) */}
          <div className="form-group">
            <label className="form-label" htmlFor="suggest-status-select">
              SUGGESTED STATUS
            </label>
            <div className="form-input-container">
              <CustomSelect
                id="suggest-status-select"
                className="master-dropdown"
                value={suggestedStatus}
                onChange={setSuggestedStatus}
                options={STATUS_OPTIONS}
                required
              />
            </div>
          </div>

          {/* Shift Type (only relevant if suggesting 'present') */}
          {suggestedStatus === 'present' && (
            <div className="form-group">
              <label className="form-label" htmlFor="suggest-shift-type-select">
                SHIFT TYPE
              </label>
              <div className="form-input-container">
                <CustomSelect
                  id="suggest-shift-type-select"
                  className="master-dropdown"
                  value={suggestedShiftType}
                  onChange={setSuggestedShiftType}
                  options={SHIFT_TYPE_OPTIONS}
                />
              </div>
            </div>
          )}


          {/* Error display */}
          {submitError && (
            <div className="suggest-edit-modal__error">
              <p>⚠ {submitError}</p>
            </div>
          )}

          {/* Footer Actions */}
          <div className="modal-footer">
            <button
              type="button"
              className="halo-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="halo-button suggest-edit-modal__submit-btn"
              disabled={isSubmitting}
              id="suggest-edit-submit"
            >
              {isSubmitting ? 'Submitting…' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AttendanceSuggestEditModal;
