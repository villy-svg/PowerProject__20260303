/**
 * AttendanceStatusPicker.jsx
 *
 * Shared pure-button 5-option status selector for Attendance Closure Maker flows
 * (reused by QuickMarkAttendance.jsx and UnmarkedAttendanceActionPanel.jsx per
 * development-best-practices §4 Union Rule).
 *
 * Design & UX guarantees:
 *   - All 5 non-present statuses are immediately visible (no dropdown).
 *   - Zero <input> elements -> mobile software keyboard can never pop up.
 *   - Semantic 4-color palette (ui-design-system §7): Danger / Warning / Neutral.
 *   - Halo selected state (ui-design-system §4) + >= 44px touch targets (§14B).
 */
import React, { useMemo } from 'react';
import { UNMARKED_ATTENDANCE_OPTIONS } from '../../services/employees/unmarkedAttendanceTaskService';
import './QuickMarkAttendance.css';

const STATUS_TONE_MAP = {
  absent: 'danger',
  'no-show': 'danger',
  'no-call-no-show': 'danger',
  leave: 'warning',
  'week-off': 'neutral',
};

const AttendanceStatusPicker = ({
  value = 'absent',
  onChange,
  disabled = false,
  ariaLabel = 'Attendance status',
}) => {
  // Place 'absent' first so the default option sits at the top-left for fastest scanning
  const orderedOptions = useMemo(() => {
    const absentOpt = UNMARKED_ATTENDANCE_OPTIONS.find((opt) => opt.value === 'absent');
    const rest = UNMARKED_ATTENDANCE_OPTIONS.filter((opt) => opt.value !== 'absent');
    return absentOpt ? [absentOpt, ...rest] : UNMARKED_ATTENDANCE_OPTIONS;
  }, []);

  return (
    <div
      className="attendance-status-grid"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {orderedOptions.map((opt) => {
        const isSelected = value === opt.value;
        const tone = STATUS_TONE_MAP[opt.value] || 'neutral';
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            className={`attendance-status-option attendance-status-option--${tone}${isSelected ? ' is-selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled && onChange) onChange(opt.value);
            }}
          >
            <span
              className={`attendance-status-option__dot attendance-status-option__dot--${tone}`}
              aria-hidden="true"
            />
            <span className="attendance-status-option__label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default AttendanceStatusPicker;
