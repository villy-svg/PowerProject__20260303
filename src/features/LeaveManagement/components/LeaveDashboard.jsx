/**
 * LeaveDashboard.jsx
 *
 * Employee-facing Leave Wallet dashboard.
 * Renders two views toggled from the Menu:
 *   1. "My Leaves"    — Leave request history + Apply button
 *   2. "Wallet Ledger" — Immutable transaction log (credits & debits)
 *
 * Skill compliance:
 *   master-header-system       (MasterPageHeader with expandedLeft toggle)
 *   ui-design-system           (halo-button, status vars, squircle, badge spec)
 *   development-best-practices (strict modularity, no raw supabase in component)
 *   runtime-stability          (all arrays default-guarded, no hook-after-return)
 */

import React, { useState } from 'react';
import MasterPageHeader from '../../../components/layout/MasterPageHeader';
import { useLeaveWallet } from '../hooks/useLeaveWallet';
import { LeaveApplicationModal } from './LeaveApplicationModal';
import { LeaveStatusBadge } from './LeaveStatusBadge';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};

const formatDateTime = (isoStr) => {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

// ─── Ledger Transaction Type Badge ───────────────────────────────────────────

const TransactionTypeBadge = ({ type }) => {
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

// ─── Shared table styles ──────────────────────────────────────────────────────

const tableWrapperStyle = {
  overflowX: 'auto',
  background: 'rgba(255, 255, 255, 0.02)',
  borderRadius: '12px',
  border: '1px solid var(--border-color)',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  textAlign: 'left',
};

const thStyle = {
  padding: '14px 16px',
  borderBottom: '1px solid var(--border-color)',
  textTransform: 'uppercase',
  opacity: 0.5,
  fontWeight: 800,
  fontSize: '0.7rem',
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '14px 16px',
  borderBottom: '1px solid var(--border-color)',
  fontSize: '0.9rem',
};

const emptyRowStyle = {
  ...tdStyle,
  textAlign: 'center',
  opacity: 0.45,
  padding: '40px 16px',
};

// ─── Sub-views ────────────────────────────────────────────────────────────────

const MyLeavesView = ({ requests = [], balance, onApply }) => (
  <div>
    {/* Balance Banner */}
    <div style={{
      background: 'var(--halo-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-squircle, 24px)',
      padding: '28px 32px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '28px',
      boxShadow: 'var(--shadow-premium, 0 4px 16px rgba(0,0,0,0.05))',
      flexWrap: 'wrap',
      gap: '16px',
    }}>
      <div>
        <div style={{
          textTransform: 'uppercase',
          opacity: 0.6,
          fontWeight: 800,
          fontSize: '0.7rem',
          letterSpacing: '1px',
          marginBottom: '8px',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          Available Earned Leaves
        </div>
        <div style={{
          fontSize: '3rem',
          fontWeight: 800,
          color: 'var(--brand-green)',
          lineHeight: 1,
        }}>
          {Number(balance || 0).toFixed(1)}
        </div>
        <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '4px' }}>
          days remaining
        </div>
      </div>
      <button
        className="halo-button"
        onClick={onApply}
        style={{ padding: '12px 28px', fontSize: '0.95rem' }}
      >
        + Apply for Leave
      </button>
    </div>

    {/* Requests Table */}
    <h3 style={{ marginBottom: '14px', fontWeight: 700, fontSize: '1rem' }}>Leave History</h3>
    <div className="responsive-table-wrapper" style={tableWrapperStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Applied On</th>
            <th style={thStyle}>Start Date</th>
            <th style={thStyle}>End Date</th>
            <th style={thStyle}>Days</th>
            <th style={thStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 ? (
            <tr>
              <td colSpan="5" style={emptyRowStyle}>No leave requests yet.</td>
            </tr>
          ) : (
            requests.map((req) => (
              <tr key={req.id}>
                <td style={tdStyle}>{formatDateTime(req.created_at)}</td>
                <td style={tdStyle}>{formatDate(req.start_date)}</td>
                <td style={tdStyle}>{formatDate(req.end_date)}</td>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{req.days_requested}</td>
                <td style={tdStyle}>
                  <LeaveStatusBadge status={req.status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const WalletLedgerView = ({ ledger = [] }) => {
  // Running balance: start from 0, compute from oldest → newest for display
  const chronological = [...ledger].reverse();
  let running = 0;
  const rows = chronological.map((entry) => {
    running += Number(entry.amount);
    return { ...entry, runningBalance: running };
  });
  // Show newest first
  const displayRows = [...rows].reverse();

  return (
    <div>
      <h3 style={{ marginBottom: '14px', fontWeight: 700, fontSize: '1rem' }}>Wallet Ledger</h3>
      <div className="responsive-table-wrapper" style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Description</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Balance After</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan="5" style={emptyRowStyle}>No transactions yet. Ledger is empty.</td>
              </tr>
            ) : (
              displayRows.map((entry) => {
                const isCredit = Number(entry.amount) > 0;
                return (
                  <tr key={entry.id}>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatDateTime(entry.created_at)}</td>
                    <td style={tdStyle}>
                      <TransactionTypeBadge type={entry.transaction_type} />
                    </td>
                    <td style={{ ...tdStyle, opacity: 0.75 }}>{entry.description || '—'}</td>
                    <td style={{
                      ...tdStyle,
                      textAlign: 'right',
                      fontWeight: 800,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: isCredit ? 'var(--status-success)' : 'var(--status-danger)',
                    }}>
                      {isCredit ? '+' : ''}{Number(entry.amount).toFixed(1)}
                    </td>
                    <td style={{
                      ...tdStyle,
                      textAlign: 'right',
                      fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: 'var(--brand-green)',
                    }}>
                      {Number(entry.runningBalance).toFixed(1)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export const LeaveDashboard = ({
  userId,
  managerId,
  // MasterPageHeader passthrough props
  setActiveVertical,
  onShowBottomNav,
  isSubSidebarOpen,
  setIsSubSidebarOpen,
  SidebarComponent,
  user,
  permissions,
  verticals,
  activeVertical,
}) => {
  const { balance, ledger, requests, isLoading, error, submitRequest, refresh } =
    useLeaveWallet(userId, managerId);

  const [viewMode, setViewMode]     = useState('leaves'); // 'leaves' | 'ledger'
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Menu: view toggle buttons (placed in expandedLeft) ──────────────────
  const headerExpandedLeft = (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
      <div className="view-mode-toggle">
        <button
          className={`view-toggle-btn ${viewMode === 'leaves' ? 'active' : ''}`}
          onClick={() => { setViewMode('leaves'); setIsMenuOpen(false); }}
        >
          My Leaves
        </button>
        <button
          className={`view-toggle-btn ${viewMode === 'ledger' ? 'active' : ''}`}
          onClick={() => { setViewMode('ledger'); setIsMenuOpen(false); }}
        >
          Wallet Ledger
        </button>
      </div>
    </div>
  );

  // ─── Header right action: Apply for Leave ────────────────────────────────
  const headerRightActions = (
    <button
      className="halo-button"
      onClick={() => setIsModalOpen(true)}
      style={{ padding: '8px 20px' }}
    >
      + Apply for Leave
    </button>
  );

  // ─── Submit handler ───────────────────────────────────────────────────────
  const handleApply = async (requestData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const result = await submitRequest(requestData);
    setIsSubmitting(false);
    if (result.success) {
      setIsModalOpen(false);
      setTimeout(refresh, 500);
    } else {
      alert('Failed to submit request: ' + result.error);
    }
  };

  // ─── Loading / Error states ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ padding: 'clamp(1rem, 3vw, 2.5rem)', color: 'var(--text-color)', opacity: 0.6 }}>
        Loading leave data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 'clamp(1rem, 3vw, 2.5rem)', color: 'var(--status-danger)' }}>
        ⚠ Error loading data: {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MasterPageHeader
        title={viewMode === 'ledger' ? 'Wallet Ledger' : 'My Leaves'}
        description={
          viewMode === 'ledger'
            ? 'A full audit trail of every credit and debit in your leave wallet.'
            : 'Track your leave balance, history, and submit new requests.'
        }
        rightActions={headerRightActions}
        expandedLeft={headerExpandedLeft}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        hideMenuClose={true}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        isSubSidebarOpen={isSubSidebarOpen}
        onSidebarToggle={setIsSubSidebarOpen}
        SidebarComponent={SidebarComponent}
        user={user}
        permissions={permissions}
        verticals={verticals}
        activeVertical={activeVertical}
      />

      <div style={{ padding: 'clamp(1rem, 3vw, 2rem)', flex: 1, overflowY: 'auto' }}>
        {viewMode === 'leaves' ? (
          <MyLeavesView
            requests={requests}
            balance={balance}
            onApply={() => setIsModalOpen(true)}
          />
        ) : (
          <WalletLedgerView ledger={ledger} />
        )}
      </div>

      <LeaveApplicationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleApply}
        maxBalance={balance}
      />
    </div>
  );
};
