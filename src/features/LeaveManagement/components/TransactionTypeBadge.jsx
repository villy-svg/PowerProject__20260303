import React from 'react';

export const TransactionTypeBadge = ({ type }) => {
  const typeMap = {
    ACCRUAL_MONTHLY: { label: 'Monthly Accrual', color: 'var(--status-success)' },
    ACCRUAL_ANNUAL:  { label: 'Annual Accrual',  color: 'var(--status-success)' },
    LEAVE_TAKEN:     { label: 'Leave Taken',      color: 'var(--status-danger)'  },
    MANUAL_ADJUSTMENT: { label: 'Manual Adj.',    color: 'var(--status-warning)' },
  };

  const { label, color } = typeMap[type] || { label: type, color: 'var(--status-neutral)' };

  return (
    <div style={{
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
      border: `1px solid ${color}`,
      color,
    }}>
      {label}
    </div>
  );
};
