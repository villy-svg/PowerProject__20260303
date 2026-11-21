/**
 * AttendanceMobileBar.jsx
 *
 * Mobile-only inline control bar rendered below MobileHeader's title
 * (since MobileHeader intentionally omits desktop leftActions/rightActions).
 * Provides week navigation, 4 quick date presets + custom From/To picker,
 * Multi-Day Update trigger, Approvals queue trigger, and Refresh.
 */

import React from 'react';

function formatCompactRange(startStr, endStr) {
  if (!startStr || !endStr) return 'Select Range';
  const fmt = (s) =>
    new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${fmt(startStr)} – ${fmt(endStr)}`;
}

const PRESETS = [
  { id: 'this-week', label: 'This Week' },
  { id: 'last-14', label: 'Last 14 Days' },
  { id: 'this-month', label: 'Current Month' },
  { id: 'last-month', label: 'Last Month' },
];

const AttendanceMobileBar = ({
  startDate,
  endDate,
  inputStart,
  inputEnd,
  setInputStart,
  setInputEnd,
  showDatePicker,
  setShowDatePicker,
  onShiftWeek,
  onApplyPreset,
  onApplyDates,
  canSuggestEdit,
  canApprove,
  pendingRequestsCount,
  isBoardLoading,
  onOpenBulkUpdate,
  onOpenApprovals,
  onRefresh,
}) => (
  <div className="attendance-mobile-bar">
    <div className="attendance-mobile-bar__range">
      <button
        type="button"
        className="halo-button attendance-mobile-bar__nav-btn"
        onClick={() => onShiftWeek(-7)}
        aria-label="Previous week"
      >
        ◀
      </button>
      <button
        type="button"
        className={`halo-button attendance-mobile-bar__range-trigger ${
          showDatePicker ? 'attendance-mobile-bar__range-trigger--open' : ''
        }`}
        onClick={() => setShowDatePicker((prev) => !prev)}
        aria-expanded={showDatePicker}
        aria-label="Select custom date range"
      >
        <span className="attendance-mobile-bar__range-text">
          {formatCompactRange(startDate, endDate)}
        </span>
        <span className="attendance-mobile-bar__range-caret" aria-hidden="true">
          {showDatePicker ? '▲' : '▼'}
        </span>
      </button>
      <button
        type="button"
        className="halo-button attendance-mobile-bar__nav-btn"
        onClick={() => onShiftWeek(7)}
        aria-label="Next week"
      >
        ▶
      </button>
    </div>

    {showDatePicker && (
      <div className="attendance-mobile-bar__picker-panel">
        <div className="attendance-mobile-bar__presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="attendance-mobile-bar__preset-chip"
              onClick={() => onApplyPreset(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="attendance-mobile-bar__date-inputs">
          <label className="attendance-mobile-bar__date-field">
            <span>From</span>
            <input
              type="date"
              className="attendance-mobile-bar__native-date"
              value={inputStart}
              onChange={(e) => setInputStart(e.target.value)}
            />
          </label>
          <label className="attendance-mobile-bar__date-field">
            <span>To</span>
            <input
              type="date"
              className="attendance-mobile-bar__native-date"
              value={inputEnd}
              min={inputStart || undefined}
              onChange={(e) => setInputEnd(e.target.value)}
            />
          </label>
        </div>
        <div className="attendance-mobile-bar__picker-actions">
          <button
            type="button"
            className="halo-button attendance-mobile-bar__picker-btn"
            onClick={() => setShowDatePicker(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="halo-button attendance-mobile-bar__picker-btn attendance-mobile-bar__picker-btn--apply"
            onClick={onApplyDates}
            disabled={!inputStart || !inputEnd}
          >
            Apply Range
          </button>
        </div>
      </div>
    )}

    <div className="attendance-mobile-bar__actions">
      {canSuggestEdit && (
        <button
          type="button"
          className="halo-button attendance-mobile-bar__btn"
          onClick={onOpenBulkUpdate}
        >
          + Multi-Day
        </button>
      )}
      {canApprove && (
        <button
          type="button"
          className="halo-button attendance-mobile-bar__btn attendance-mobile-bar__btn--approval"
          onClick={onOpenApprovals}
        >
          {pendingRequestsCount > 0 && (
            <span className="attendance-board__pending-badge">
              {pendingRequestsCount}
            </span>
          )}
          Approvals
        </button>
      )}
      <button
        type="button"
        className="halo-button attendance-mobile-bar__icon-btn"
        onClick={onRefresh}
        disabled={isBoardLoading}
        aria-label="Refresh attendance"
      >
        {isBoardLoading ? '…' : '↻'}
      </button>
    </div>
  </div>
);

export default AttendanceMobileBar;
