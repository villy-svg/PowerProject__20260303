import React from 'react';
import { LeaveStatusBadge } from './LeaveStatusBadge';
import { formatDate, formatDateTime } from '../../../utils/leaveFormatters';
import './LeaveDashboard.css';

export const MyLeavesView = ({ requests = [], balance, onApply, viewAllMode }) => (
  <div>
    {/* Balance Banner - Hide for Global Viewers since they don't have a personal balance here */}
    {!viewAllMode && (
      <div className="leave-balance-banner">
        <div className="leave-balance-info">
          <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 }}>
            {balance}
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
    )}

    {/* Requests Table */}
    <h3 style={{ marginBottom: '14px', fontWeight: 700, fontSize: '1rem' }}>
      {viewAllMode ? 'All Leave Requests' : 'Leave History'}
    </h3>
    <div className="leave-table-wrapper">
      <table className="leave-table">
        <thead>
          <tr>
            {viewAllMode && <th className="leave-th">Employee</th>}
            <th className="leave-th">Applied On</th>
            <th className="leave-th">Start Date</th>
            <th className="leave-th">End Date</th>
            <th className="leave-th">Days</th>
            <th className="leave-th">Status</th>
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 ? (
            <tr>
              <td colSpan={viewAllMode ? "6" : "5"} className="leave-empty-row">
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
                <td className="leave-td">{formatDate(req.start_date)}</td>
                <td className="leave-td">{formatDate(req.end_date)}</td>
                <td className="leave-td bold">{req.days_requested}</td>
                <td className="leave-td">
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
