import React, { useState } from 'react';
import { IconSun, IconMoon, IconCoffee, IconFile, IconX } from '../../../components/ui/Icons';
import BaseDropdown from '../../../components/ui/BaseDropdown';

// Status labels and classes (from Grid)
const STATUS_META = {
  'present':  { label: 'Present',   className: 'attendance-list-item--present'  },
  'week-off': { label: 'Week-Off',  className: 'attendance-list-item--week-off' },
  'leave':    { label: 'Leave',     className: 'attendance-list-item--leave'    },
  'absent':   { label: 'Absent',    className: 'attendance-list-item--absent'   },
};

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

const AttendanceMobileList = ({ employees, dateRange, getCellData, isLoading, onCellClick, dateFilterControl }) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  if (isLoading) {
    return (
      <div className="attendance-mobile-list__loading">
        <p>Loading attendance...</p>
      </div>
    );
  }

  if (!employees || employees.length === 0) {
    return (
      <div className="attendance-grid__empty-state">
        <div className="empty-state-icon">📅</div>
        <h3 className="empty-state-title">No Employees Found</h3>
        <p className="empty-state-text">No active employees match the current filters.</p>
      </div>
    );
  }

  if (!dateRange || dateRange.length === 0) {
    return (
      <div className="attendance-mobile-list">
        {dateFilterControl && (
          <div className="attendance-mobile-list__date-filters">
            {dateFilterControl}
          </div>
        )}
        <div className="attendance-grid__empty-state">
          <div className="empty-state-icon">⚠️</div>
          <h3 className="empty-state-title">Invalid Date Range</h3>
          <p className="empty-state-text">Please select a valid From and To date.</p>
        </div>
      </div>
    );
  }

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || employees[0];

  // Calculate Summary Counts
  const counts = {
    presentDay: 0,
    presentNight: 0,
    absent: 0,
    weekOff: 0,
    leave: 0,
  };

  if (selectedEmployee) {
    dateRange.forEach(date => {
      const record = getCellData(selectedEmployee.id, date);
      const status = record?.attendance_status || 'absent';
      if (status === 'present') {
        if (record.shift_type === 'night') counts.presentNight++;
        else counts.presentDay++;
      } else if (status === 'week-off') {
        counts.weekOff++;
      } else if (status === 'leave') {
        counts.leave++;
      } else {
        counts.absent++;
      }
    });
  }

  return (
    <div className="attendance-mobile-list">
      {dateFilterControl && (
        <div className="attendance-mobile-list__date-filters">
          {dateFilterControl}
        </div>
      )}

      {employees.length > 1 && (
        <div className="attendance-mobile-list__selector">
          <label htmlFor="mobile-employee-select">Select Employee</label>
          <BaseDropdown
            id="mobile-employee-select"
            options={employees.map(emp => ({
              value: emp.id,
              label: `${emp.full_name} ${emp.emp_code ? `(${emp.emp_code})` : ''}`
            }))}
            value={selectedEmployee?.id || ''}
            onChange={(val) => setSelectedEmployeeId(val)}
            mode="single"
            searchable={true}
            searchPlaceholder="Search employee..."
            placeholder="Select Employee"
          />
        </div>
      )}

      <div className="attendance-summary-cards">
        <div className="attendance-summary-card">
          <span className="attendance-summary-card__value">{dateRange.length}</span>
          <span className="attendance-summary-card__label">Total Days</span>
        </div>
        <div className="attendance-summary-card attendance-summary-card--present">
          <span className="attendance-summary-card__value" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><IconSun size={18} /> {counts.presentDay}</span>
          <span className="attendance-summary-card__label">Present (Day)</span>
        </div>
        <div className="attendance-summary-card attendance-summary-card--present">
          <span className="attendance-summary-card__value" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><IconMoon size={18} /> {counts.presentNight}</span>
          <span className="attendance-summary-card__label">Present (Night)</span>
        </div>
        <div className="attendance-summary-card attendance-summary-card--weekoff">
          <span className="attendance-summary-card__value" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><IconCoffee size={18} /> {counts.weekOff}</span>
          <span className="attendance-summary-card__label">Week-Off</span>
        </div>
        <div className="attendance-summary-card attendance-summary-card--leave">
          <span className="attendance-summary-card__value" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><IconFile size={18} /> {counts.leave}</span>
          <span className="attendance-summary-card__label">Leave</span>
        </div>
        <div className="attendance-summary-card attendance-summary-card--absent">
          <span className="attendance-summary-card__value" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><IconX size={18} /> {counts.absent}</span>
          <span className="attendance-summary-card__label">Absent</span>
        </div>
      </div>

      <div className="attendance-mobile-list__items">
        {dateRange.map(date => {
          const record = getCellData(selectedEmployee.id, date);
          const status = record?.attendance_status || 'absent';
          const meta = STATUS_META[status] || STATUS_META['absent'];
          const hasPendingEdit = !!record?.has_pending_edit;
          const shiftType = record?.shift_type;

          return (
            <div 
              key={date}
              className={`attendance-list-item ${meta.className} ${hasPendingEdit ? 'attendance-list-item--has-pending' : ''}`}
              onClick={() => onCellClick(selectedEmployee.id, date)}
              role="button"
              tabIndex={0}
            >
              <div className="attendance-list-item__date">
                {formatDate(date)}
              </div>
              <div className="attendance-list-item__details">
                <span className="attendance-list-item__status-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {status === 'present' ? (shiftType === 'night' ? <IconMoon size={16} /> : <IconSun size={16} />) : null}
                  {status === 'week-off' ? <IconCoffee size={16} /> : null}
                  {status === 'leave' ? <IconFile size={16} /> : null}
                  {status === 'absent' ? <IconX size={16} /> : null}
                </span>
                {hasPendingEdit && (
                  <span className="attendance-list-item__pending-badge">⚠ Pending</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AttendanceMobileList;
