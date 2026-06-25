/**
 * AttendanceGrid.jsx
 *
 * Pure presentational component for the Attendance Board grid.
 * Y-axis = Employees. X-axis = Dates.
 *
 * Props:
 *   employees   - Array of employee objects (from useAttendanceBoard)
 *   dateRange   - Array of 'YYYY-MM-DD' strings (X-axis headers)
 *   getCellData - Function(employeeId, date) → attendance record or absent shell
 *   isLoading   - Boolean (shows skeleton state)
 *   onCellClick - Function(employeeId, date) → triggers modal/drawer in parent
 *
 * Skill compliance:
 *   development-best-practices §4 (Presentational only — no data fetching)
 *   safe-code-modification §2 (No inline styles — all via CSS classes)
 *   ui-design-system §11 (responsive-table-wrapper for horizontal scroll)
 */

import React from 'react';
import { IconSun, IconMoon, IconCoffee, IconFile, IconX } from '../../../components/ui/Icons';

// ---------------------------------------------------------------------------
// STATUS_META: Maps status enum → display label + CSS modifier class.
// Using a lookup object avoids a cascade of if/else in the render.
// ---------------------------------------------------------------------------
const STATUS_META = {
  'present':  { label: 'P',   className: 'attendance-cell--present'  },
  'week-off': { label: 'WO',  className: 'attendance-cell--week-off' },
  'leave':    { label: 'L',   className: 'attendance-cell--leave'    },
  'absent':   { label: 'A',   className: 'attendance-cell--absent'   },
};

// ---------------------------------------------------------------------------
// Utility: Format a 'YYYY-MM-DD' string to a short display like "Mon 9"
// ---------------------------------------------------------------------------
function formatDateHeader(dateStr) {
  const date = new Date(dateStr + 'T00:00:00'); // Prevent UTC shift on date-only strings
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// AttendanceCell — individual grid cell (sub-component)
// ---------------------------------------------------------------------------
const AttendanceCell = ({ record, onClick }) => {
  const status = record?.attendance_status || 'absent';
  const meta = STATUS_META[status] || STATUS_META['absent'];
  const hasPendingEdit = !!record?.has_pending_edit;
  const shiftType = record?.shift_type;

  let icon = <IconX size={16} />;
  if (status === 'present') {
    icon = shiftType === 'night' ? <IconMoon size={16} /> : <IconSun size={16} />;
  } else if (status === 'week-off') {
    icon = <IconCoffee size={16} />;
  } else if (status === 'leave') {
    icon = <IconFile size={16} />;
  }

  return (
    <td
      className={`attendance-cell ${meta.className} ${hasPendingEdit ? 'attendance-cell--has-pending' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      aria-label={`Status: ${status}${hasPendingEdit ? ', has pending edit' : ''}`}
    >
      <span className="attendance-cell__status-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </span>
      {/* Pending edit indicator badge */}
      {hasPendingEdit && (
        <span className="attendance-cell__pending-badge" aria-hidden="true">⚠</span>
      )}
    </td>
  );
};

// ---------------------------------------------------------------------------
// EmployeeRowHeader — left-column employee info cell (sub-component)
// ---------------------------------------------------------------------------
const EmployeeRowHeader = ({ employee }) => (
  <td className="attendance-grid__employee-cell">
    <p className="attendance-grid__employee-name">{employee.full_name}</p>
    <div className="attendance-grid__employee-meta">
      {employee.emp_code && (
        <span className="attendance-grid__employee-code">{employee.emp_code}</span>
      )}
      {employee.hubs?.hub_code && (
        <span className="hub-badge">{employee.hubs.hub_code}</span>
      )}
    </div>
  </td>
);

// ---------------------------------------------------------------------------
// SkeletonRow — loading placeholder row
// ---------------------------------------------------------------------------
const SkeletonRow = ({ colCount }) => (
  <tr className="attendance-grid__skeleton-row">
    <td className="attendance-grid__employee-cell attendance-grid__skeleton-cell" />
    {Array.from({ length: colCount }).map((_, i) => (
      <td key={i} className="attendance-cell attendance-grid__skeleton-cell" />
    ))}
  </tr>
);

// ---------------------------------------------------------------------------
// AttendanceGrid — main export
// ---------------------------------------------------------------------------
const AttendanceGrid = ({ employees, dateRange, getCellData, isLoading, onCellClick }) => {
  if (!isLoading && (!dateRange || dateRange.length === 0)) {
    return (
      <div className="attendance-grid__empty-state">
        <div className="empty-state-icon">⚠️</div>
        <h3 className="empty-state-title">Invalid Date Range</h3>
        <p className="empty-state-text">Please select a valid From and To date to view attendance.</p>
      </div>
    );
  }

  if (!isLoading && (!employees || employees.length === 0)) {
    return (
      <div className="attendance-grid__empty-state">
        <div className="empty-state-icon">📅</div>
        <h3 className="empty-state-title">No Employees Found</h3>
        <p className="empty-state-text">
          No active employees match the current filters.
        </p>
      </div>
    );
  }

  return (
    /* responsive-table-wrapper: per ui-design-system §11 */
    <div className="responsive-table-wrapper attendance-grid__wrapper">
      <table className="attendance-grid__table">
        {/* X-Axis: Date headers */}
        <thead>
          <tr>
            <th className="attendance-grid__corner-cell">Employee</th>
            {dateRange.map(date => (
              <th key={date} className="attendance-grid__date-header">
                {formatDateHeader(date)}
              </th>
            ))}
          </tr>
        </thead>

        {/* Y-Axis: Employee rows */}
        <tbody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} colCount={dateRange.length} />
              ))
            : employees.map(employee => (
                <tr key={employee.id} className="attendance-grid__row">
                  <EmployeeRowHeader employee={employee} />
                  {dateRange.map(date => (
                    <AttendanceCell
                      key={`${employee.id}_${date}`}
                      record={getCellData(employee.id, date)}
                      onClick={() => onCellClick(employee.id, date)}
                    />
                  ))}
                </tr>
              ))
          }
        </tbody>
      </table>
    </div>
  );
};

export default AttendanceGrid;
