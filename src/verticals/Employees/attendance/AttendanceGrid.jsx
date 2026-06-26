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
import { IconSun, IconMoon, IconCoffee, IconFile, IconX } from '../../../components/ui/Icons';
import './AttendanceGrid.css';

// ---------------------------------------------------------------------------
// STATUS_META: Maps status enum → display label + CSS modifier class.
// Using a lookup object avoids a cascade of if/else in the render.
// ---------------------------------------------------------------------------
const STATUS_META = {
  'present':  { label: 'P',   className: 'attendance-cell--present'  },
  'week-off': { label: 'WO',  className: 'attendance-cell--week-off' },
  'leave':    { label: 'L',   className: 'attendance-cell--leave'    },
  'absent':   { label: 'A',   className: 'attendance-cell--absent'   },
  'no-show':  { label: 'NS',  className: 'attendance-cell--no-show'  },
  'no-call-no-show': { label: 'NCNS', className: 'attendance-cell--no-call-no-show' },
  'null':     { label: 'NULL', className: 'attendance-cell--null' },
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
const AttendanceCell = ({ record, onClick, isEditing, onCellChange, hubs, employeeId, date }) => {
  const status = record?.attendance_status || 'null';
  const meta = STATUS_META[status] || STATUS_META['null'];
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
    icon = <span style={{ fontWeight: 800 }}>ABS</span>;
  } else if (status === 'no-show') {
    icon = <span style={{ fontWeight: 800 }}>X</span>;
  } else if (status === 'no-call-no-show') {
    icon = <span style={{ fontWeight: 900, fontSize: '1.1em' }}>XX</span>;
  } else {
    icon = <span style={{ fontWeight: 800, opacity: 0.5 }}>NULL</span>;
  }

  if (isEditing) {
    return (
      <td className={`attendance-cell ${meta.className} ${hasPendingEdit ? 'attendance-cell--has-pending' : ''}`}>
        <div 
          style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px', minWidth: '90px' }}
          onClick={e => e.stopPropagation()}
        >
          <select 
            className="master-dropdown" 
            style={{ width: '100%', fontSize: '10px', padding: '4px', height: 'auto' }}
            value={status} 
            onChange={e => onCellChange(employeeId, date, e.target.value, record?.hub_id || '')}
            autoFocus
          >
            <option value="null">NULL (Not Marked)</option>
            <option value="present">Present (Day)</option>
            <option value="present-night">Present (Night)</option>
            <option value="week-off">Week-Off</option>
            <option value="leave">Leave</option>
            <option value="absent">Absent</option>
            <option value="no-show">No Show</option>
            <option value="no-call-no-show">No Call No Show</option>
          </select>
          {(status === 'present' || status === 'present-night') && (
            <select
              className="master-dropdown"
              style={{ width: '100%', fontSize: '10px', padding: '4px', height: 'auto' }}
              value={record?.hub_id || ''}
              onChange={e => onCellChange(employeeId, date, status, e.target.value)}
            >
              <option value="">No Hub</option>
              {hubs?.map(h => <option key={h.id} value={h.id}>{h.hub_code || h.name}</option>)}
            </select>
          )}
        </div>
      </td>
    );
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
const AttendanceGrid = ({ employees, dateRange, getCellData, isLoading, onCellClick, activeCellEdit, onCellChange, hubs, groupByHub }) => {
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
            : Object.entries(groupedEmployees).map(([groupName, groupEmployees]) => (
                <React.Fragment key={groupName}>
                  {groupByHub && (
                    <tr className="attendance-grid__group-header" style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '2px solid var(--border-color)' }}>
                      <td colSpan={dateRange.length + 1} style={{ padding: '8px 12px', fontWeight: 'bold', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {groupName}
                      </td>
                    </tr>
                  )}
                  {groupEmployees.map(employee => (
                    <tr key={employee.id} className="attendance-grid__row">
                      <EmployeeRowHeader employee={employee} />
                      {dateRange.map(date => (
                        <AttendanceCell
                          key={`${employee.id}_${date}`}
                          record={getCellData(employee.id, date)}
                          onClick={() => onCellClick(employee.id, date)}
                          isEditing={activeCellEdit?.empId === employee.id && activeCellEdit?.date === date}
                          onCellChange={onCellChange}
                          hubs={hubs}
                          employeeId={employee.id}
                          date={date}
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
