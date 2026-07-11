import React from 'react';
import { TransactionTypeBadge } from './TransactionTypeBadge';
import { formatDateTime, formatDate } from '../../../utils/leaveFormatters';
import './LeaveDashboard.css';

export const WalletLedgerView = ({ ledger = [], viewAllMode, page, setPage, totalCount, pageSize }) => {
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div>
      <h3 style={{ marginBottom: '14px', fontWeight: 700, fontSize: '1rem' }}>
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
                      <td style={{ fontWeight: 600 }}>{entry.employees?.full_name || 'Unknown'}</td>
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
                      <td style={{ fontWeight: 600 }}>
                        {Number(entry.running_balance || 0).toFixed(1)}
                      </td>
                    )}
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {entry.description}
                      {entry.attendance_edit_requests?.maker_note && (
                        <div style={{ fontSize: '0.8rem', fontStyle: 'italic', marginTop: '4px' }}>
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Page {page} of {totalPages}
          </span>
          <button 
            className="halo-button secondary" 
            disabled={page <= 1} 
            onClick={() => setPage(page - 1)}
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
          >
            Previous
          </button>
          <button 
            className="halo-button secondary" 
            disabled={page >= totalPages} 
            onClick={() => setPage(page + 1)}
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
