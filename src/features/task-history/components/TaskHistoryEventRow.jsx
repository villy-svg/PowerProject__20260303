import React from 'react';
import { IconChevronRightSingle } from '../../../components/ui/Icons';

/**
 * TaskHistoryEventRow
 * Pure presentational timeline row for `kind === 'history'` events.
 * Uses a native <button type="button"> when expandable diffs exist so it never
 * accidentally submits parent <form> wrappers and provides full keyboard support.
 *
 * Canonical location: src/features/task-history/components/TaskHistoryEventRow.jsx
 */
const TaskHistoryEventRow = ({
  item,
  isExpanded = false,
  onToggle,
  isLast = false,
  formatDate,
}) => {
  const { id, timestamp, actorName, data } = item || {};
  const {
    eventType = 'edit',
    summary = 'Updated task',
    changes = [],
  } = data || {};

  const safeChanges = Array.isArray(changes) ? changes : [];
  const hasDetails = safeChanges.length > 0;
  const panelId = `history-diff-${id || 'event'}`;
  const formattedTime = timestamp ? (formatDate ? formatDate(timestamp) : timestamp) : '';

  const rowInner = (
    <>
      <span className="history-event-main">
        <span className="history-actor">{actorName || 'System'}</span>
        <span className="history-summary">{summary}</span>
      </span>
      <span className="history-event-meta">
        {formattedTime && <span className="submission-timestamp">{formattedTime}</span>}
        {hasDetails && (
          <span
            className={`history-chevron ${isExpanded ? 'is-expanded' : ''}`}
            aria-hidden="true"
          >
            <IconChevronRightSingle size={14} />
          </span>
        )}
      </span>
    </>
  );

  return (
    <div className={`submission-item history-item ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Timeline rail: 8px history dot centered inside the shared 12px .timeline-marker */}
      <div className="timeline-marker" aria-hidden="true">
        <div className={`history-node history-node--${eventType}`} />
        {!isLast && <div className="timeline-line" />}
      </div>

      <div className="submission-content history-content">
        {hasDetails ? (
          <button
            type="button"
            className={`history-event-row history-event-row--expandable ${isExpanded ? 'is-expanded' : ''}`}
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={panelId}
          >
            {rowInner}
          </button>
        ) : (
          <div className="history-event-row">{rowInner}</div>
        )}

        {hasDetails && isExpanded && (
          <div id={panelId} className="history-event-diff fade-in">
            {safeChanges.map((change, idx) => {
              const { field, label, oldValue, newValue } = change || {};
              const hasOld = oldValue !== null && oldValue !== undefined && oldValue !== '';
              const hasNew = newValue !== null && newValue !== undefined && newValue !== '';

              return (
                <div className="history-diff-row" key={`${field || label || 'change'}-${idx}`}>
                  <span className="history-diff-field">{label || field || 'Field'}</span>
                  <span className="history-diff-values">
                    {hasOld && <span className="history-diff-old">{oldValue}</span>}
                    {hasOld && hasNew && (
                      <span className="history-diff-arrow" aria-hidden="true">→</span>
                    )}
                    {hasNew && <span className="history-diff-new">{newValue}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskHistoryEventRow;
