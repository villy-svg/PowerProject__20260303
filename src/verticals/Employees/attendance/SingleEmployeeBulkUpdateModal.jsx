/**
 * SingleEmployeeBulkUpdateModal.jsx
 *
 * Simplified Schedule / Multi-Day Update modal (Section A.2):
 * Lets a Contributor/Manager pick ONE employee and MULTIPLE dates at once,
 * choose a status (and shift type / leave reason when applicable), and submit
 * pending attendance edit requests for Editor approval.
 *
 * Replaces the complex multi-employee paintbrush Schedule Planner for now;
 * external bulk planner wiring (useSchedulePlanner / schedulePlannerService)
 * remains intact for future rebuild.
 */

import React, { useState, useMemo } from 'react';
import { submitEditRequest } from '../../../services/employees/editRequestService';
import BaseDropdown from '../../../components/ui/BaseDropdown';
import CustomSelect from '../../../components/ui/CustomSelect';
import {
  ATTENDANCE_STATUS_OPTIONS,
  SHIFT_TYPE_OPTIONS,
} from './utils/attendanceStatusMeta';
import { buildDefaultShiftTimes } from './utils/attendanceDateUtils';
import './SingleEmployeeBulkUpdateModal.css';

function formatShortDay(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  return {
    weekday: date.toLocaleDateString('en-IN', { weekday: 'short' }),
    dayMonth: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  };
}

const SingleEmployeeBulkUpdateModal = ({
  employees,
  dateRange,
  getCellData,
  initialEmployeeId = '',
  currentUser,
  onClose,
  onSubmitComplete,
}) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    initialEmployeeId || employees?.[0]?.id || ''
  );
  const [selectedDates, setSelectedDates] = useState([]);
  const [status, setStatus] = useState('week-off');
  const [shiftType, setShiftType] = useState('day');
  const [leaveReason, setLeaveReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const employeeOptions = useMemo(
    () =>
      (employees || []).map((emp) => ({
        value: emp.id,
        label: `${emp.full_name}${emp.emp_code ? ` (${emp.emp_code})` : ''}`,
      })),
    [employees]
  );

  const toggleDate = (date) => {
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  const handleSelectAll = () => {
    setSelectedDates([...(dateRange || [])]);
  };

  const handleClearDates = () => {
    setSelectedDates([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!selectedEmployeeId) {
      setSubmitError('Please select an employee.');
      return;
    }
    if (selectedDates.length === 0) {
      setSubmitError('Please select at least one date.');
      return;
    }
    if (status === 'present' && !shiftType) {
      setSubmitError('Please select a shift type (Day or Night) for Present.');
      return;
    }
    if (status === 'leave' && !leaveReason.trim()) {
      setSubmitError('Please enter a reason for leave.');
      return;
    }

    setIsSubmitting(true);
    let succeeded = 0;
    let firstError = null;

    try {
      for (const date of selectedDates) {
        const { loginTime: finalLoginTime, logoutTime: finalLogoutTime } = buildDefaultShiftTimes(
          date,
          status,
          shiftType
        );

        const existingRecord = getCellData ? getCellData(selectedEmployeeId, date) : null;

        const { error } = await submitEditRequest({
          employeeId: selectedEmployeeId,
          shiftDate: date,
          suggestedStatus: status,
          suggestedShiftType: status === 'present' ? shiftType : null,
          suggestedFirstLoginTime: finalLoginTime,
          suggestedLogoutTime: finalLogoutTime,
          dailyAttendanceId: existingRecord?.id || null,
          requestedBy: currentUser?.id,
          makerNote: status === 'leave' ? leaveReason.trim() : null,
        });

        if (error) {
          if (!firstError) firstError = error;
        } else {
          succeeded++;
        }
      }

      if (firstError) {
        setSubmitError(
          succeeded > 0
            ? `Submitted ${succeeded} of ${selectedDates.length} dates. Some failed: ${firstError.message || 'Unknown error'}`
            : firstError.message || 'Failed to submit updates. Please try again.'
        );
        if (succeeded > 0 && onSubmitComplete) {
          onSubmitComplete();
        }
      } else if (onSubmitComplete) {
        onSubmitComplete();
      }
    } catch (err) {
      console.error('[SingleEmployeeBulkUpdateModal] handleSubmit error:', err);
      setSubmitError(err?.message || 'Failed to submit updates. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay modal-overlay--bottom-sheet" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-content modal-body bulk-update-modal"
        onClick={(e) => e.stopPropagation()}
        aria-label="Multi-day attendance update"
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Multi-Day Update</h2>
            <p className="modal-subtitle">
              Update multiple dates for one employee (sent for approval)
            </p>
          </div>
          <button
            type="button"
            className="halo-button modal-close-btn"
            onClick={onClose}
            aria-label="Close multi-day update modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vertical-task-form bulk-update-modal__form">
          <div className="modal-content-area">
            {/* Employee Selector */}
            <div className="form-group">
              <label className="form-label" htmlFor="bulk-update-employee">
                EMPLOYEE
              </label>
              <div className="form-input-container">
                <BaseDropdown
                  id="bulk-update-employee"
                  options={employeeOptions}
                  value={selectedEmployeeId}
                  onChange={setSelectedEmployeeId}
                  mode="single"
                  searchable={true}
                  searchPlaceholder="Search employee..."
                  placeholder="Select Employee"
                />
              </div>
            </div>

            {/* Multi-Date Selector */}
            <div className="form-group">
              <div className="bulk-update-modal__dates-header">
                <label className="form-label">
                  DATES ({selectedDates.length} SELECTED)
                </label>
                <div className="bulk-update-modal__date-actions">
                  <button
                    type="button"
                    className="bulk-update-modal__link-btn"
                    onClick={handleSelectAll}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="bulk-update-modal__link-btn"
                    onClick={handleClearDates}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="bulk-update-modal__date-grid">
                {(dateRange || []).map((date) => {
                  const isSelected = selectedDates.includes(date);
                  const { weekday, dayMonth } = formatShortDay(date);
                  return (
                    <button
                      key={date}
                      type="button"
                      className={`bulk-update-modal__date-chip ${
                        isSelected ? 'bulk-update-modal__date-chip--selected' : ''
                      }`}
                      onClick={() => toggleDate(date)}
                      aria-pressed={isSelected}
                    >
                      <span className="bulk-update-modal__date-weekday">{weekday}</span>
                      <span className="bulk-update-modal__date-day">{dayMonth}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status Selector */}
            <div className="form-group">
              <label className="form-label" htmlFor="bulk-update-status">
                STATUS
              </label>
              <div className="form-input-container">
                <CustomSelect
                  id="bulk-update-status"
                  className="master-dropdown"
                  value={status}
                  onChange={setStatus}
                  options={ATTENDANCE_STATUS_OPTIONS}
                  required
                />
              </div>
            </div>

            {/* Shift Type (when Present) */}
            {status === 'present' && (
              <div className="form-group">
                <label className="form-label" htmlFor="bulk-update-shift">
                  SHIFT TYPE
                </label>
                <div className="form-input-container">
                  <CustomSelect
                    id="bulk-update-shift"
                    className="master-dropdown"
                    value={shiftType}
                    onChange={setShiftType}
                    options={SHIFT_TYPE_OPTIONS.filter((o) => o.value !== '')}
                  />
                </div>
              </div>
            )}

            {/* Leave Reason (when Leave) */}
            {status === 'leave' && (
              <div className="form-group">
                <label className="form-label" htmlFor="bulk-update-leave-reason">
                  REASON FOR LEAVE
                </label>
                <div className="form-input-container">
                  <textarea
                    id="bulk-update-leave-reason"
                    className="u-w-full u-min-h-80 u-p-12 u-rounded-12 u-border-light u-outline-none"
                    placeholder="Enter reason for leave..."
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {submitError && (
              <div className="attendance-board__error bulk-update-modal__error">
                <p>⚠ {submitError}</p>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="halo-button suggest-edit-modal__cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="halo-button suggest-edit-modal__submit-btn"
              disabled={isSubmitting || selectedDates.length === 0}
            >
              {isSubmitting
                ? 'Submitting…'
                : `Submit ${selectedDates.length || ''} ${selectedDates.length === 1 ? 'Day' : 'Days'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SingleEmployeeBulkUpdateModal;
