import React from 'react';
import { TransactionTypeBadge } from './TransactionTypeBadge';
import { formatDateTime, formatDate } from '../../../utils/leaveFormatters';
import './LeaveDashboard.css';

export const WalletLedgerView = ({ ledger = [], viewAllMode, page, setPage, totalCount, pageSize }) => {
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div>
      <h3 className="wallet-ledger__header">
        {viewAllMode ? 'Global Wallet Ledger' : 'Wallet Ledger'}
      </h3>

      <div className="leave-list-container">
        {ledger.length === 0 ? (
          <div className="leave-empty-state">No wallet transactions found.</div>
        ) : (
          <table className="leave-wallet-table">
            <thead>
              <tr>
                {viewAllMode && <th>Employee</th>}
                <th>Date</th>
                <th>Transaction</th>
                <th>Leave Type</th>
                <th>Amount</th>
                {!viewAllMode && <th>Balance After</th>}
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map(entry => {
                const isCredit = Number(entry.amount) > 0;
                return (
                  <tr key={entry.id}>
                    {viewAllMode && (
                      <td className="u-fw-600">{entry.employees?.full_name || 'Unknown'}</td>
                    )}
                    <td>{formatDateTime(entry.created_at)}</td>
                    <td>
                      <TransactionTypeBadge type={entry.transaction_type} />
                    </td>
                    <td>{entry.leave_type || 'PL'}</td>
                    <td style={{ 
                      color: isCredit ? 'var(--brand-green, #10b981)' : 'var(--brand-orange, #f97316)',
                      fontWeight: 700 
                    }}>
                      {isCredit ? '+' : ''}{Number(entry.amount).toFixed(1)}
                    </td>
                    {!viewAllMode && (
                      <td className="u-fw-600">
                        {Number(entry.running_balance || 0).toFixed(1)}
                      </td>
                    )}
                    <td className="u-text-secondary">
                      {entry.description}
                      {entry.attendance_edit_requests?.maker_note && (
                        <div className="wallet-ledger__note">
                          Note: {entry.attendance_edit_requests.maker_note}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="u-flex-end-gap-16 u-mt-16">
          <span className="u-text-sm u-text-secondary">
            Page {page} of {totalPages}
          </span>
          <button 
            className="halo-button secondary btn-sm" 
            disabled={page <= 1} 
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <button 
            className="halo-button secondary btn-sm" 
            disabled={page >= totalPages} 
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
