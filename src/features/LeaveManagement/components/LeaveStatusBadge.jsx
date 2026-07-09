import React from 'react';

/**
 * Standardized semantic status badge for Leave requests.
 * Uses the Global Unified 4-Color Status Palette from UI Design System.
 */
export const LeaveStatusBadge = ({ status }) => {
  // Normalize status for styling
  const s = status ? status.toUpperCase() : 'PENDING';
  
  let colorVar = 'var(--status-neutral)';
  
  if (s === 'APPROVED') {
    colorVar = 'var(--status-success)';
  } else if (s === 'REJECTED' || s === 'CANCELLED') {
    colorVar = 'var(--status-danger)';
  } else if (s === 'FLAGGED_FOR_REVIEW') {
    colorVar = 'var(--status-warning)';
  }

  const badgeStyle = {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 800,
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderRadius: '4px',
    padding: '1px 8px',
    minHeight: '20px',
    display: 'inline-flex',
    alignItems: 'center',
    lineHeight: 1,
    background: 'rgba(255, 255, 255, 0.05)',
    border: `1px solid ${colorVar}`,
    color: colorVar
  };

  // Convert underscores to spaces for display
  const displayLabel = s.replace(/_/g, ' ');

  return (
    <div style={badgeStyle} className="leave-status-badge">
      {displayLabel}
    </div>
  );
};
