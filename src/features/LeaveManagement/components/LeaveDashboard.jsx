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
import { MyLeavesView } from './MyLeavesView';
import { WalletLedgerView } from './WalletLedgerView';

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
  // If the user has "canRead" but NOT "canCreate", they are a pure viewer.
  // If they have "canUpdate" or "canManageRoles", they are an admin.
  const isGlobalViewer = permissions?.canReadLeaveWallet && (
    !permissions?.canCreateLeaveWallet || 
    permissions?.canUpdateLeaveWallet || 
    permissions?.canManageRoles
  );

  const { balance, ledger, requests, isLoading, error, submitRequest, refresh } =
    useLeaveWallet(userId, managerId, isGlobalViewer);

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
          {isGlobalViewer ? 'All Leaves' : 'My Leaves'}
        </button>
        <button
          className={`view-toggle-btn ${viewMode === 'ledger' ? 'active' : ''}`}
          onClick={() => { setViewMode('ledger'); setIsMenuOpen(false); }}
        >
          {isGlobalViewer ? 'Global Ledger' : 'Wallet Ledger'}
        </button>
      </div>
    </div>
  );

  // ─── Header right action: Apply for Leave ────────────────────────────────
  const headerRightActions = !isGlobalViewer && (
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
        title={viewMode === 'ledger' 
          ? (isGlobalViewer ? 'Global Ledger' : 'Wallet Ledger') 
          : (isGlobalViewer ? 'All Leaves' : 'My Leaves')}
        description={
          viewMode === 'ledger'
            ? 'A full audit trail of every credit and debit in the leave wallet.'
            : 'Track leave balances, history, and requests.'
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
            viewAllMode={isGlobalViewer}
          />
        ) : (
          <WalletLedgerView ledger={ledger} viewAllMode={isGlobalViewer} />
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
