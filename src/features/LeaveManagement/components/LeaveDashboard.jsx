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
import RBACManageButton from '../../../components/ui/RBACManageButton';
import './LeaveDashboard.css';
import { useLeaveWallet } from '../hooks/useLeaveWallet';
import { LeaveApplicationModal } from './LeaveApplicationModal';
import { UpdateWalletBalanceModal } from './UpdateWalletBalanceModal';
import { LeaveStatusBadge } from './LeaveStatusBadge';
import { MyLeavesView } from './MyLeavesView';
import { WalletLedgerView } from './WalletLedgerView';
import { leaveService } from '../services/leaveService';

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

  const { balance, ledger, ledgerCount, requests, requestsCount, page, setPage, pageSize, isLoading, error, submitRequest, refresh } =
    useLeaveWallet(userId, managerId, isGlobalViewer);

  const [viewMode, setViewMode]     = useState('leaves'); // 'leaves' | 'ledger'
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [isUpdateWalletModalOpen, setIsUpdateWalletModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Left Action: view toggle buttons ──────────────────
  const headerLeftActions = (
    <div className="leave-dashboard-toggles-container" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div className="view-mode-toggle">
        <button
          className={`view-toggle-btn ${viewMode === 'leaves' ? 'active' : ''}`}
          onClick={() => { setViewMode('leaves'); setPage(1); setIsMenuOpen(false); }}
        >
          {isGlobalViewer ? 'All Leaves' : 'My Leaves'}
        </button>
        <button
          className={`view-toggle-btn ${viewMode === 'ledger' ? 'active' : ''}`}
          onClick={() => { setViewMode('ledger'); setPage(1); setIsMenuOpen(false); }}
        >
          {isGlobalViewer ? 'Global Ledger' : 'Wallet Ledger'}
        </button>
      </div>
      {isGlobalViewer && viewMode === 'ledger' && (
        <button 
          className="halo-button secondary" 
          onClick={() => setIsUpdateWalletModalOpen(true)}
          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
        >
          + Update Wallet Balance
        </button>
      )}
    </div>
  );
  const headerRightActions = (
    <>
      {!isGlobalViewer && (
        <button
          className="halo-button apply-leave-btn"
          onClick={() => setIsModalOpen(true)}
        >
          + Apply for Leave
        </button>
      )}
      <RBACManageButton
        user={user}
        verticalId="employees"
        featureId="canAccessEmployeeLeaveWallet"
        label="Leave Manager"
      />
    </>
  );

  // ─── Submit handlers ───────────────────────────────────────────────────────
  const handleApply = async (requestData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    // requestData comes from LeaveApplicationModal with employee_id missing, we add it here
    const fullRequest = {
      ...requestData,
      employee_id: userId,
      requested_by: user?.id
    };
    try {
      await submitRequest(fullRequest);
      setIsModalOpen(false);
      setTimeout(refresh, 500);
    } catch (err) {
      alert('Failed to submit request: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateWallet = async (employeeId, amount, description, leaveType) => {
    await leaveService.addManualAdjustment(employeeId, amount, description, user?.employeeId, leaveType);
    setTimeout(refresh, 500);
  };

  const handleRunAccrual = async () => {
    // Prompt the user for the target month
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const targetMonth = window.prompt(
      "Enter the month to run accrual for (YYYY-MM). If backfilling, this will use the 1st of that month.",
      currentMonth
    );

    if (!targetMonth) return;

    // Validate format
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      alert("Invalid format. Please use YYYY-MM (e.g., 2026-06).");
      return;
    }

    // Determine the target date based on whether it's the current month or a past month
    let targetDateStr;
    if (targetMonth === currentMonth) {
      // Use today for current month
      targetDateStr = new Date().toISOString().split('T')[0];
    } else {
      // Use the 1st of the target month
      targetDateStr = `${targetMonth}-01`;
    }

    if (!window.confirm(`Are you sure you want to run the automated monthly accrual for ${targetMonth}?`)) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      await leaveService.runMonthlyAccrual(user?.employeeId, targetDateStr);
      refresh();
      alert("Monthly accrual completed successfully.");
    } catch (err) {
      alert('Failed to run monthly accrual: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Loading / Error states ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="leave-loading-state">
        Loading leave data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="leave-error-state">
        ⚠ Error loading data: {error}
      </div>
    );
  }

  return (
    <div className="leave-dashboard-layout">
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
        leftActions={
          <div className="leave-dashboard-toggles-container" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="view-mode-toggle">
              <button
                className={`view-toggle-btn ${viewMode === 'leaves' ? 'active' : ''}`}
                onClick={() => { setViewMode('leaves'); setPage(1); setIsMenuOpen(false); }}
              >
                {isGlobalViewer ? 'All Leaves' : 'My Leaves'}
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'ledger' ? 'active' : ''}`}
                onClick={() => { setViewMode('ledger'); setPage(1); setIsMenuOpen(false); }}
              >
                {isGlobalViewer ? 'Global Ledger' : 'Wallet Ledger'}
              </button>
            </div>
            {isGlobalViewer && viewMode === 'ledger' && (
              <>
                <button 
                  className="halo-button secondary" 
                  onClick={() => setIsUpdateWalletModalOpen(true)}
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  + Update Wallet Balance
                </button>
                <button 
                  className="halo-button secondary" 
                  onClick={handleRunAccrual}
                  disabled={isSubmitting}
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  {isSubmitting ? 'Running...' : 'Run Monthly Accrual'}
                </button>
              </>
            )}
          </div>
        }
        hideSearchBar={true}
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

      <div className="leave-dashboard-content-area">
        {viewMode === 'leaves' ? (
          <MyLeavesView
            requests={requests}
            balance={balance}
            onApply={() => setIsModalOpen(true)}
            viewAllMode={isGlobalViewer}
            page={page}
            setPage={setPage}
            totalCount={requestsCount}
            pageSize={pageSize}
          />
        ) : (
          <WalletLedgerView 
            ledger={ledger} 
            viewAllMode={isGlobalViewer}
            page={page}
            setPage={setPage}
            totalCount={ledgerCount}
            pageSize={pageSize}
          />
        )}
      </div>

      <LeaveApplicationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleApply}
        maxBalance={balance}
        employeeId={userId}
      />

      <UpdateWalletBalanceModal
        isOpen={isUpdateWalletModalOpen}
        onClose={() => setIsUpdateWalletModalOpen(false)}
        onSubmit={handleUpdateWallet}
      />
    </div>
  );
};
