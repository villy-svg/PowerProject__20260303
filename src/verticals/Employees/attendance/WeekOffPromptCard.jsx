/**
 * WeekOffPromptCard.jsx
 *
 * Lightweight, dismissible self-service prompt shown once per unmarked
 * previous shift day on Current Attendance.
 *   - Non-consecutive Week-Off -> auto-saves immediately.
 *   - Consecutive Week-Off     -> escalates to manager Maker-Checker task.
 *   - Dismiss ("No")           -> suppressed for that date via localStorage.
 *
 * Skill compliance:
 *   ui-design-system §1  (Zero inline styles)
 *   ui-design-system §14B (Touch targets >= 44px)
 *   development-best-practices §4 (Single-responsibility sub-component)
 */

import React from 'react';

function formatShiftDateLabel(isoDate) {
  if (!isoDate) return 'yesterday';
  // Parse YYYY-MM-DD safely without local timezone drift
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return dt.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

const WeekOffPromptCard = ({
  prompt,
  feedback,
  isClaiming,
  onClaim,
  onDismiss,
  onClearFeedback,
}) => {
  if (feedback) {
    const toneClass =
      feedback.tone === 'warning'
        ? 'weekoff-prompt__feedback--warning'
        : feedback.tone === 'error'
          ? 'weekoff-prompt__feedback--error'
          : 'weekoff-prompt__feedback--success';

    return (
      <div
        className={`weekoff-prompt__feedback ${toneClass}`}
        role="status"
        aria-live="polite"
      >
        <span className="weekoff-prompt__feedback-text">{feedback.message}</span>
        {onClearFeedback && (
          <button
            type="button"
            className="weekoff-prompt__dismiss-x"
            onClick={onClearFeedback}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  if (!prompt?.is_unmarked || !prompt?.target_date) {
    return null;
  }

  const formattedDate = formatShiftDateLabel(prompt.target_date);

  return (
    <section
      className="weekoff-prompt__card"
      role="region"
      aria-label="Previous day Week-Off check"
    >
      <div className="weekoff-prompt__header">
        <span className="weekoff-prompt__badge">Previous Shift Unmarked</span>
        <p className="weekoff-prompt__question">
          No attendance was recorded for <strong>{formattedDate}</strong>. Was that your Week-Off?
        </p>
        {prompt.previous_day_was_weekoff && (
          <p className="weekoff-prompt__hint">
            The day before was also a Week-Off — confirming will send a quick approval request to your manager.
          </p>
        )}
      </div>

      <div className="weekoff-prompt__actions">
        <button
          type="button"
          className="halo-button weekoff-prompt__btn weekoff-prompt__btn--confirm"
          onClick={() => onClaim(prompt.target_date)}
          disabled={isClaiming}
        >
          {isClaiming ? 'Saving…' : 'Yes, my Week-Off'}
        </button>
        <button
          type="button"
          className="halo-button weekoff-prompt__btn weekoff-prompt__btn--dismiss"
          onClick={() => onDismiss(prompt.target_date)}
          disabled={isClaiming}
        >
          No
        </button>
      </div>
    </section>
  );
};

export default WeekOffPromptCard;
