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

import React, { useMemo } from 'react';
import { IconSun, IconMoon, IconCoffee, IconFile } from '../../../components/ui/Icons';
import {
  ATTENDANCE_STATUS_META,
  formatAttendanceStatusLabel,
} from './utils/attendanceStatusMeta';
import { toISTDateString } from './utils/attendanceDateUtils';
import './AttendanceGrid.css';

// ---------------------------------------------------------------------------
// Utility: Format a 'YYYY-MM-DD' string to a short display like "Mon 9"
// ---------------------------------------------------------------------------
function formatDateHeader(dateStr) {
  const date = new Date(dateStr + 'T00:00:00'); // Prevent UTC shift on date-only strings
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
}

function formatHoverTooltip(record, status, shiftType) {
  const parts = [formatAttendanceStatusLabel(status, shiftType)];
  if (record?.first_login_time) {
    parts.push(`In: ${new Date(record.first_login_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
  }
  if (record?.logout_time) {
    parts.push(`Out: ${new Date(record.logout_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
  }
  if (record?.has_pending_edit) {
    parts.push('Pending Edit');
  }
  return parts.join(' • ');
}

// ---------------------------------------------------------------------------
// AttendanceCell — individual grid cell (sub-component)
// TODO(future-rebuild): Inline cell <select> editing (isEditing/onCellChange/hubs)
// was stripped when bulk Schedule Planner was parked. Restore when rebuilding bulk planner.
// ---------------------------------------------------------------------------
const AttendanceCell = React.memo(({ record, onClick, isToday }) => {
  const status = record?.attendance_status || 'null';
  const meta = ATTENDANCE_STATUS_META[status] || ATTENDANCE_STATUS_META['null'];
  const hasPendingEdit = !!record?.has_pending_edit;
  const shiftType = record?.shift_type;

  let icon = null;
  if (status === 'present') {
    icon = shiftType === 'night' ? <IconMoon size={16} /> : <IconSun size={16} />;
  } else if (status === 'week-off') {
    icon = <IconCoffee size={16} />;
  } else if (status === 'leave') {
    icon = <IconFile size={16} />;
  } else if (status === 'absent') {
    icon = <span className="u-fw-800">ABS</span>;
  } else if (status === 'no-show') {
    icon = <span className="u-fw-800">X</span>;
  } else if (status === 'no-call-no-show') {
    icon = <span className="u-fw-900 u-text-1-1em">XX</span>;
  } else {
    icon = <span className="u-fw-800 u-opacity-50">NULL</span>;
  }

  return (
    <td
      className={`attendance-cell ${meta.gridClass} ${hasPendingEdit ? 'attendance-cell--has-pending' : ''} ${isToday ? 'attendance-cell--today' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      title={formatHoverTooltip(record, status, shiftType)}
      aria-label={`Status: ${meta.label}${hasPendingEdit ? ', has pending edit' : ''}`}
    >
      <span className="attendance-cell__status-label u-flex-center">
        {icon}
      </span>
      {/* Pending edit indicator badge */}
      {hasPendingEdit && (
        <span className="attendance-cell__pending-badge" aria-hidden="true">⚠</span>
      )}
    </td>
  );
}, (prev, next) => {
  return prev.isToday === next.isToday &&
         prev.record?.attendance_status === next.record?.attendance_status &&
         prev.record?.shift_type === next.record?.shift_type &&
         prev.record?.first_login_time === next.record?.first_login_time &&
         prev.record?.logout_time === next.record?.logout_time &&
         prev.record?.hub_id === next.record?.hub_id &&
         prev.record?.has_pending_edit === next.record?.has_pending_edit &&
         prev.record?.is_draft === next.record?.is_draft;
});

// ---------------------------------------------------------------------------
// EmployeeRowHeader — left-column employee info cell (sub-component)
// ---------------------------------------------------------------------------
const EmployeeRowHeader = ({ employee }) => (
  <td className="attendance-grid__employee-cell">
    <div className="attendance-grid__employee-info">
      <h4 className="attendance-grid__employee-name" title={employee.full_name}>{employee.full_name}</h4>
      {(employee.emp_code || employee.hubs?.hub_code) && (
        <div className="attendance-grid__employee-badges">
          {employee.emp_code && (
            <span className="attendance-grid__badge attendance-grid__badge--id" title="Employee ID">{employee.emp_code}</span>
          )}
          {employee.hubs?.hub_code && (
            <span className="attendance-grid__badge attendance-grid__badge--hub" title="Primary Hub">{employee.hubs.hub_code}</span>
          )}
        </div>
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
const AttendanceGrid = ({ employees, dateRange, getCellData, isLoading, onCellClick, groupByHub = false }) => {
  const todayStr = useMemo(() => toISTDateString(new Date()), []);
  const groupedEmployees = useMemo(() => {
    if (!groupByHub || !employees) return { 'All Employees': employees || [] };
    const groups = {};
    employees.forEach(emp => {
      const hubName = emp.hubs?.name || emp.hubs?.hub_code || 'Unassigned';
      if (!groups[hubName]) groups[hubName] = [];
      groups[hubName].push(emp);
    });
    // Sort groups alphabetically
    const sortedGroups = {};
    Object.keys(groups).sort().forEach(key => {
      sortedGroups[key] = groups[key];
    });
    return sortedGroups;
  }, [employees, groupByHub]);
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
              <th
                key={date}
                className={`attendance-grid__date-header ${date === todayStr ? 'attendance-grid__date-header--today' : ''}`}
              >
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
            : Object.entries(groupedEmployees).map(([groupName, groupEmployees]) => (
                <React.Fragment key={groupName}>
                  {groupByHub && (
                    <tr className="attendance-grid__group-header u-bg-secondary u-border-t-2-border">
                      <td colSpan={dateRange.length + 1} className="u-px-12 u-py-8 u-fw-bold u-text-secondary u-text-sm-85 u-uppercase u-letter-spacing-05">
                        {groupName}
                      </td>
                    </tr>
                  )}
                  {groupEmployees.map(employee => (
                    <tr key={employee.id} id={`attendance-row-${employee.id}`} className="attendance-grid__row">
                      <EmployeeRowHeader employee={employee} />
                      {dateRange.map(date => (
                        <AttendanceCell
                          key={`${employee.id}_${date}`}
                          record={getCellData(employee.id, date)}
                          onClick={() => onCellClick(employee.id, date)}
                          isToday={date === todayStr}
                        />
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))
          }
        </tbody>
      </table>
    </div>
  );
};

export default AttendanceGrid;
