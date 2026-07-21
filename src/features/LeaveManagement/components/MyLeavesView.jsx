import React from 'react';
import { LeaveStatusBadge } from './LeaveStatusBadge';
import { formatDate, formatDateTime } from '../../../utils/leaveFormatters';
import './LeaveDashboard.css';

export const MyLeavesView = ({ requests = [], balance, onApply, viewAllMode, page, setPage, totalCount, pageSize }) => (
  <div>
    {/* Balance Banner - Hide for Global Viewers since they don't have a personal balance here */}
    {!viewAllMode && (
      <div className="leave-balance-banner">
        <div className="u-flex-wrap-gap-32">
          {balance && typeof balance === 'object' && Object.entries(balance).map(([type, amount]) => (
            <div key={type} className="leave-balance-info my-leaves__stat-item">
              <div className="my-leaves__stat-value">
                {Number(amount).toFixed(1)}
              </div>
              <div className="my-leaves__stat-label">
                {type}
              </div>
            </div>
          ))}
        </div>
        <button
          className="halo-button master-action-btn"
          onClick={onApply}
        >
          + Apply for Leave
        </button>
      </div>
    )}

    {/* Requests Table */}
    <div className="u-flex-between u-mb-14">
      <h3 className="u-fw-700 u-m-0">
        {viewAllMode ? 'All Leave Requests (Day-by-Day)' : 'Leave History (Day-by-Day)'}
      </h3>
      {viewAllMode && (
        <span className="u-label-muted">
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
                  <td className="leave-td bold u-text-brand-green">
                    {req.employees?.full_name}
                  </td>
                )}
                <td className="leave-td">{formatDateTime(req.created_at)}</td>
                <td className="leave-td bold">{formatDate(req.shift_date)}</td>
                <td className="leave-td u-overflow-ellipsis u-max-w-200">
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
      <div className="u-flex-end-gap-16 u-mt-16">
        <span className="u-text-sm u-text-secondary">
          Page {page} of {Math.ceil(totalCount / pageSize)}
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
          disabled={page >= Math.ceil(totalCount / pageSize)} 
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    )}
  </div>
);
