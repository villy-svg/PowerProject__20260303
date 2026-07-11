import React from 'react';
import { LeaveStatusBadge } from './LeaveStatusBadge';
import { formatDate, formatDateTime } from '../../../utils/leaveFormatters';
import './LeaveDashboard.css';

export const MyLeavesView = ({ requests = [], balance, onApply, viewAllMode, page, setPage, totalCount, pageSize }) => (
  <div>
    {/* Balance Banner - Hide for Global Viewers since they don't have a personal balance here */}
    {!viewAllMode && (
      <div className="leave-balance-banner">
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          {balance && typeof balance === 'object' && Object.entries(balance).map(([type, amount]) => (
            <div key={type} className="leave-balance-info" style={{ alignItems: 'flex-start' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 }}>
                {Number(amount).toFixed(1)}
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {type}
              </div>
            </div>
          ))}
        </div>
        <button
          className="halo-button"
          onClick={onApply}
          style={{ padding: '12px 28px', fontSize: '0.95rem' }}
        >
          + Apply for Leave
        </button>
      </div>
    )}

    {/* Requests Table */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
      <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>
        {viewAllMode ? 'All Leave Requests (Day-by-Day)' : 'Leave History (Day-by-Day)'}
      </h3>
      {viewAllMode && (
        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
          * To approve or reject leaves, please use the <strong>Attendance Approval Drawer</strong>.
        </span>
      )}
    </div>
    
    <div className="leave-table-wrapper">
      <table className="leave-table">
        <thead>
          <tr>
            {viewAllMode && <th className="leave-th">Employee</th>}
            <th className="leave-th">Applied On</th>
            <th className="leave-th">Leave Date</th>
            <th className="leave-th">Reason</th>
            <th className="leave-th">Status</th>
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 ? (
            <tr>
              <td colSpan={viewAllMode ? "5" : "4"} className="leave-empty-row">
                No leave requests yet.
              </td>
            </tr>
          ) : (
            requests.map((req) => (
              <tr key={req.id}>
                {viewAllMode && (
                  <td className="leave-td bold" style={{ color: 'var(--brand-green)' }}>
                    {req.employees?.full_name}
                  </td>
                )}
                <td className="leave-td">{formatDateTime(req.created_at)}</td>
                <td className="leave-td bold">{formatDate(req.shift_date)}</td>
                <td className="leave-td" style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {req.maker_note || '-'}
                </td>
                <td className="leave-td">
                  <LeaveStatusBadge status={req.request_status?.toUpperCase()} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    {page !== undefined && totalCount !== undefined && Math.ceil(totalCount / pageSize) > 1 && (
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Page {page} of {Math.ceil(totalCount / pageSize)}
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
          disabled={page >= Math.ceil(totalCount / pageSize)} 
          onClick={() => setPage(page + 1)}
          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
        >
          Next
        </button>
      </div>
    )}
  </div>
);
