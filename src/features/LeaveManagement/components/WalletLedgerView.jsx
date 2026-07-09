import React from 'react';
import { TransactionTypeBadge } from './TransactionTypeBadge';
import { formatDateTime } from '../../../utils/leaveFormatters';
import './LeaveDashboard.css';

export const WalletLedgerView = ({ ledger = [], viewAllMode }) => {
  // Running balance: start from 0, compute from oldest → newest for display
  const chronological = [...ledger].reverse();
  let running = 0;
  const computedLedger = chronological.map(entry => {
    running += Number(entry.amount);
    return { ...entry, runningBalance: running };
  }).reverse(); // reverse back to newest first

  return (
    <div>
      <h3 style={{ marginBottom: '14px', fontWeight: 700, fontSize: '1rem' }}>
        {viewAllMode ? 'Global Wallet Ledger' : 'Wallet Ledger'}
      </h3>
      <div className="leave-table-wrapper">
        <table className="leave-table">
          <thead>
            <tr>
              {viewAllMode && <th className="leave-th">Employee</th>}
              <th className="leave-th">Date</th>
              <th className="leave-th">Type</th>
              <th className="leave-th">Description</th>
              <th className="leave-th text-right">Amount</th>
              {!viewAllMode && <th className="leave-th text-right">Balance After</th>}
            </tr>
          </thead>
          <tbody>
            {computedLedger.length === 0 ? (
              <tr>
                <td colSpan={viewAllMode ? "5" : "5"} className="leave-empty-row">
                  No transactions yet.
                </td>
              </tr>
            ) : (
              computedLedger.map((entry) => {
                const isCredit = Number(entry.amount) > 0;
                return (
                  <tr key={entry.id}>
                    {viewAllMode && (
                      <td className="leave-td bold" style={{ color: 'var(--brand-green)' }}>
                        <div style={{ fontWeight: '500' }}>
                          {entry.employees?.full_name}
                        </div>
                      </td>
                    )}
                    <td className="leave-td nowrap">{formatDateTime(entry.created_at)}</td>
                    <td className="leave-td">
                      <TransactionTypeBadge type={entry.transaction_type} />
                    </td>
                    <td className="leave-td" style={{ opacity: 0.75 }}>
                      {entry.description || '—'}
                    </td>
                    <td 
                      className="leave-td font-mono extra-bold text-right"
                      style={{ color: isCredit ? 'var(--status-success)' : 'var(--status-danger)' }}
                    >
                      {isCredit ? '+' : ''}{Number(entry.amount).toFixed(1)}
                    </td>
                    {!viewAllMode && (
                      <td 
                        className="leave-td font-mono bold text-right"
                        style={{ color: 'var(--brand-green)' }}
                      >
                        {Number(entry.runningBalance).toFixed(1)}
                      </td>
                    )}
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
