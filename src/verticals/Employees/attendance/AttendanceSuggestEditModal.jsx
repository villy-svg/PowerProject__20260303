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
import { useLayoutShell } from '../../../app/shells/useLayoutShell';
import {
  ATTENDANCE_STATUS_OPTIONS,
  SHIFT_TYPE_OPTIONS,
} from './utils/attendanceStatusMeta';
import { buildDefaultShiftTimes } from './utils/attendanceDateUtils';

const MOBILE_STATUS_CHIPS = [
  { key: 'present-day',     status: 'present',         shiftType: 'day',   label: '☀ Day' },
  { key: 'present-night',   status: 'present',         shiftType: 'night', label: '🌙 Night' },
  { key: 'week-off',        status: 'week-off',        shiftType: '',      label: '☕ Week-Off' },
  { key: 'leave',           status: 'leave',           shiftType: '',      label: '📄 Leave' },
  { key: 'absent',          status: 'absent',          shiftType: '',      label: 'ABS Absent' },
  { key: 'no-show',         status: 'no-show',         shiftType: '',      label: 'X No Show' },
  { key: 'no-call-no-show', status: 'no-call-no-show', shiftType: '',      label: 'XX NCNS' },
];

const AttendanceSuggestEditModal = ({
  selectedCell,
  currentUser,
  onClose,
  onSubmitComplete,
}) => {
  const { shellType } = useLayoutShell();
  const isMobileSheet = shellType === 'mobile';
  const { employeeId, date, record, employeeName } = selectedCell || {};

  // Form state — default to the existing record's values if available
  const initialStatus = (record?.attendance_status && record.attendance_status !== 'null') 
    ? record.attendance_status 
    : 'present';
    
  const [suggestedStatus, setSuggestedStatus] = useState(initialStatus);
  const [suggestedShiftType, setSuggestedShiftType] = useState(
    record?.shift_type || (initialStatus === 'present' ? 'day' : '')
  );
  const [suggestedLeaveReason, setSuggestedLeaveReason] = useState('');

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
    setSubmitError(null);

    if (suggestedStatus === 'present' && !suggestedShiftType) {
      setSubmitError('Please select a Shift Type (Day or Night) for Present.');
      return;
    }

    setIsSubmitting(true);

    const { loginTime: finalLoginTime, logoutTime: finalLogoutTime } = buildDefaultShiftTimes(
      date,
      suggestedStatus,
      suggestedShiftType
    );

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
        makerNote:               suggestedStatus === 'leave' ? suggestedLeaveReason : null,
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
    /* Modal overlay (ui-design-system §5) — bottom-anchored sheet on mobile (adaptive-ui-strategy §4/§6) */
    <div
      className={`modal-overlay ${isMobileSheet ? 'modal-overlay--bottom-sheet' : ''}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Stop click propagation so clicking inside the modal doesn't close it */}
      <div
        className={`modal-content modal-body suggest-edit-modal ${isMobileSheet ? 'suggest-edit-modal--sheet' : ''}`}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="vertical-task-form suggest-edit-modal__form">
          <div className="modal-content-area">
            {/* Current Status (read-only context) */}
            {record?.attendance_status && (
              <div className="form-group">
                <label className="form-label">CURRENT STATUS</label>
                <div className="form-input-container suggest-edit-modal__current-status">
                  <span>{record.attendance_status.toUpperCase()}</span>
                </div>
              </div>
            )}

            {record?.has_pending_edit && (
              <div className="attendance-board__error u-mb-12">
                <p>⚠ A pending edit request already exists for this date. Submitting again will create another pending request.</p>
              </div>
            )}

            {/* Suggested Status — 1-tap chips on Mobile, Master Dropdown on Desktop */}
            {isMobileSheet ? (
              <div className="form-group">
                <label className="form-label">SELECT STATUS</label>
                <div className="suggest-edit-chips" role="radiogroup" aria-label="Attendance status">
                  {MOBILE_STATUS_CHIPS.map((chip) => {
                    const isSelected =
                      suggestedStatus === chip.status &&
                      (chip.status !== 'present' || suggestedShiftType === chip.shiftType);
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`suggest-edit-chip ${isSelected ? 'suggest-edit-chip--selected' : ''}`}
                        onClick={() => {
                          setSuggestedStatus(chip.status);
                          setSuggestedShiftType(chip.shiftType);
                        }}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
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
                      options={ATTENDANCE_STATUS_OPTIONS}
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
              </>
            )}

            {/* Leave Reason (only relevant if suggesting 'leave') */}
            {suggestedStatus === 'leave' && (
              <div className="form-group">
                <label className="form-label" htmlFor="suggest-leave-reason">
                  REASON FOR LEAVE
                </label>
                <div className="form-input-container">
                  <textarea
                    id="suggest-leave-reason"
                    className="u-w-full u-min-h-80 u-p-12 u-rounded-12 u-border-light u-outline-none"
                    placeholder="Enter reason for applying leave on behalf of the employee..."
                    value={suggestedLeaveReason}
                    onChange={(e) => setSuggestedLeaveReason(e.target.value)}
                    required
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
          </div>

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
