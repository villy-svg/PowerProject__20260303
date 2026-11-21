import React, { useState, useMemo, useEffect } from 'react';
import { IconSun, IconMoon, IconCoffee, IconFile } from '../../../components/ui/Icons';
import BaseDropdown from '../../../components/ui/BaseDropdown';
import {
  ATTENDANCE_STATUS_META,
  formatAttendanceStatusLabel,
} from './utils/attendanceStatusMeta';
import { toISTDateString } from './utils/attendanceDateUtils';

function formatFullDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatDayPill(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return {
    weekday: date.toLocaleDateString('en-IN', { weekday: 'short' }),
    day: date.getDate(),
    month: date.toLocaleDateString('en-IN', { month: 'short' }),
  };
}

function formatTimeShort(isoStr) {
  if (!isoStr) return '';
  try {
    return new Date(isoStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

function getStatusBucket(status) {
  if (status === 'present') return 'present';
  if (status === 'week-off') return 'week-off';
  if (status === 'leave') return 'leave';
  if (status === 'absent' || status === 'no-show' || status === 'no-call-no-show') return 'absent';
  return 'null';
}

function renderStatusIcon(status, shiftType) {
  if (status === 'present') {
    return shiftType === 'night' ? <IconMoon size={14} /> : <IconSun size={14} />;
  }
  if (status === 'week-off') return <IconCoffee size={14} />;
  if (status === 'leave') return <IconFile size={14} />;
  return null;
}

const AttendanceMobileList = ({
  employees,
  dateRange,
  getCellData,
  isLoading,
  onCellClick,
  selectedEmployeeId: controlledSelectedEmployeeId,
  onSelectEmployee,
}) => {
  const todayStr = useMemo(() => toISTDateString(new Date()), []);
  const isSingleEmployeeScope = (employees?.length || 0) <= 1;

  // Dual-mode mobile view: Managers default to 'by-day' roll-call; restricted viewers open 'by-employee'
  const [mobileMode, setMobileMode] = useState(isSingleEmployeeScope ? 'by-employee' : 'by-day');
  const [selectedDay, setSelectedDay] = useState(() =>
    dateRange?.includes(todayStr) ? todayStr : (dateRange?.[0] || '')
  );
  const [dayStatusFilter, setDayStatusFilter] = useState('all');

  // Controlled employee selection (synced with global SearchBar when user searches an employee)
  const [internalSelectedEmployeeId, setInternalSelectedEmployeeId] = useState('');
  const selectedEmployeeId = controlledSelectedEmployeeId !== undefined
    ? controlledSelectedEmployeeId
    : internalSelectedEmployeeId;

  const handleSelectEmployee = (val) => {
    setInternalSelectedEmployeeId(val);
    if (onSelectEmployee) onSelectEmployee(val);
  };

  // Keep selectedDay valid whenever dateRange changes (e.g., switching presets or weeks)
  useEffect(() => {
    if (!dateRange || dateRange.length === 0) {
      setSelectedDay('');
      return;
    }
    if (!dateRange.includes(selectedDay)) {
      setSelectedDay(dateRange.includes(todayStr) ? todayStr : dateRange[0]);
    }
  }, [dateRange, selectedDay, todayStr]);

  // If restricted viewer only has 1 employee, force timeline view
  useEffect(() => {
    if (isSingleEmployeeScope) {
      setMobileMode('by-employee');
    }
  }, [isSingleEmployeeScope]);

  // When a manager picks an employee via the global SearchBar, jump to their Timeline view
  useEffect(() => {
    if (controlledSelectedEmployeeId && !isSingleEmployeeScope) {
      setMobileMode('by-employee');
    }
  }, [controlledSelectedEmployeeId, isSingleEmployeeScope]);

  const handleOpenEmployeeHistory = (empId, e) => {
    if (e) e.stopPropagation();
    handleSelectEmployee(empId);
    setMobileMode('by-employee');
  };

  // ── By-Day derived rows & bucket counts ──────────────────────────────────
  const dayRows = useMemo(() => {
    if (!selectedDay || !employees || employees.length === 0) return [];
    return employees.map((emp) => {
      const record = getCellData(emp.id, selectedDay);
      const status = record?.attendance_status || 'null';
      return {
        emp,
        record,
        status,
        bucket: getStatusBucket(status),
        hasPendingEdit: !!record?.has_pending_edit,
      };
    });
  }, [employees, selectedDay, getCellData]);

  const dayCounts = useMemo(() => {
    const c = { all: dayRows.length, present: 0, 'week-off': 0, leave: 0, absent: 0, null: 0, pending: 0 };
    dayRows.forEach((row) => {
      c[row.bucket] = (c[row.bucket] || 0) + 1;
      if (row.hasPendingEdit) c.pending++;
    });
    return c;
  }, [dayRows]);

  const filteredDayRows = useMemo(() => {
    if (dayStatusFilter === 'all') return dayRows;
    if (dayStatusFilter === 'pending') return dayRows.filter((r) => r.hasPendingEdit);
    return dayRows.filter((r) => r.bucket === dayStatusFilter);
  }, [dayRows, dayStatusFilter]);

  // ── By-Employee derived counts ───────────────────────────────────────────
  const selectedEmployee = useMemo(
    () => (employees || []).find((e) => e.id === selectedEmployeeId) || employees?.[0] || null,
    [employees, selectedEmployeeId]
  );

  const employeeCounts = useMemo(() => {
    const c = { total: dateRange?.length || 0, present: 0, weekOff: 0, leave: 0, absent: 0, nullCount: 0 };
    if (!selectedEmployee || !dateRange) return c;
    dateRange.forEach((date) => {
      const record = getCellData(selectedEmployee.id, date);
      const bucket = getStatusBucket(record?.attendance_status || 'null');
      if (bucket === 'present') c.present++;
      else if (bucket === 'week-off') c.weekOff++;
      else if (bucket === 'leave') c.leave++;
      else if (bucket === 'absent') c.absent++;
      else c.nullCount++;
    });
    return c;
  }, [selectedEmployee, dateRange, getCellData]);

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
        <div className="attendance-grid__empty-state">
          <div className="empty-state-icon">⚠️</div>
          <h3 className="empty-state-title">Invalid Date Range</h3>
          <p className="empty-state-text">Please select a valid From and To date.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="attendance-mobile-list">
      {/* Mode Toggle (Managers only — hidden for single-employee viewers) */}
      {!isSingleEmployeeScope && (
        <div className="attendance-mobile-mode-toggle" role="tablist" aria-label="Attendance mobile view">
          <button
            type="button"
            role="tab"
            aria-selected={mobileMode === 'by-day'}
            className={`attendance-mobile-mode-toggle__btn ${
              mobileMode === 'by-day' ? 'attendance-mobile-mode-toggle__btn--active' : ''
            }`}
            onClick={() => setMobileMode('by-day')}
          >
            By Day ({employees.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileMode === 'by-employee'}
            className={`attendance-mobile-mode-toggle__btn ${
              mobileMode === 'by-employee' ? 'attendance-mobile-mode-toggle__btn--active' : ''
            }`}
            onClick={() => setMobileMode('by-employee')}
          >
            By Employee
          </button>
        </div>
      )}

      {mobileMode === 'by-day' ? (
        <>
          {/* Horizontal Day Strip */}
          <div className="attendance-day-strip" role="listbox" aria-label="Select date">
            {dateRange.map((date) => {
              const { weekday, day, month } = formatDayPill(date);
              const isSelected = date === selectedDay;
              const isToday = date === todayStr;
              return (
                <button
                  key={date}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`attendance-day-pill ${
                    isSelected ? 'attendance-day-pill--active' : ''
                  } ${isToday ? 'attendance-day-pill--today' : ''}`}
                  onClick={() => setSelectedDay(date)}
                >
                  <span className="attendance-day-pill__weekday">{weekday}</span>
                  <span className="attendance-day-pill__day">{day}</span>
                  <span className="attendance-day-pill__month">{month}</span>
                </button>
              );
            })}
          </div>

          {/* Tappable Status Filter Chips */}
          <div className="attendance-summary-pills">
            {[
              { id: 'all', label: `All ${dayCounts.all}`, mod: '' },
              { id: 'present', label: `Present ${dayCounts.present}`, mod: 'attendance-summary-pill--present' },
              { id: 'week-off', label: `WO ${dayCounts['week-off']}`, mod: 'attendance-summary-pill--weekoff' },
              { id: 'leave', label: `Leave ${dayCounts.leave}`, mod: 'attendance-summary-pill--leave' },
              { id: 'absent', label: `Absent/NS ${dayCounts.absent}`, mod: 'attendance-summary-pill--absent' },
              { id: 'null', label: `Not Marked ${dayCounts.null}`, mod: 'attendance-summary-pill--null' },
              ...(dayCounts.pending > 0
                ? [{ id: 'pending', label: `⚠ Pending ${dayCounts.pending}`, mod: 'attendance-summary-pill--pending' }]
                : []),
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`attendance-summary-pill attendance-summary-pill--interactive ${chip.mod} ${
                  dayStatusFilter === chip.id ? 'attendance-summary-pill--active' : ''
                }`}
                onClick={() => setDayStatusFilter(chip.id)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Employee Roll-Call Cards for Selected Day */}
          <div className="attendance-mobile-list__items">
            {filteredDayRows.length === 0 ? (
              <div className="attendance-mobile-list__empty-filter">
                No employees match this status on {selectedDay ? formatFullDate(selectedDay) : 'this day'}.
              </div>
            ) : (
              filteredDayRows.map(({ emp, record, status, hasPendingEdit }) => {
                const meta = ATTENDANCE_STATUS_META[status] || ATTENDANCE_STATUS_META['null'];
                const shiftType = record?.shift_type;
                const readableLabel = formatAttendanceStatusLabel(status, shiftType);
                const loginStr = formatTimeShort(record?.first_login_time);
                const logoutStr = formatTimeShort(record?.logout_time);

                return (
                  <div
                    key={emp.id}
                    className={`attendance-list-item attendance-list-item--rollcall ${meta.mobileClass} ${
                      hasPendingEdit ? 'attendance-list-item--has-pending' : ''
                    }`}
                    onClick={() => onCellClick(emp.id, selectedDay)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="attendance-list-item__emp-col">
                      <div className="attendance-list-item__emp-name">{emp.full_name}</div>
                      <div className="attendance-list-item__emp-meta">
                        {emp.emp_code && (
                          <span className="attendance-list-item__badge">{emp.emp_code}</span>
                        )}
                        {emp.hubs?.hub_code && (
                          <span className="attendance-list-item__badge attendance-list-item__badge--hub">
                            {emp.hubs.hub_code}
                          </span>
                        )}
                        {loginStr && (
                          <span className="attendance-list-item__time">
                            {loginStr}{logoutStr ? ` – ${logoutStr}` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="attendance-list-item__details">
                      <span className="attendance-list-item__status-label u-flex-center-gap-4">
                        {renderStatusIcon(status, shiftType)}
                        <span>{readableLabel}</span>
                      </span>
                      <div className="attendance-list-item__sub-actions">
                        {hasPendingEdit && (
                          <span className="attendance-list-item__pending-badge">⚠ Pending</span>
                        )}
                        <button
                          type="button"
                          className="attendance-list-item__history-btn"
                          onClick={(e) => handleOpenEmployeeHistory(emp.id, e)}
                        >
                          History →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          {/* By-Employee Timeline View */}
          {employees.length > 1 && (
            <div className="attendance-mobile-list__selector">
              <label htmlFor="mobile-employee-select">Select Employee</label>
              <BaseDropdown
                id="mobile-employee-select"
                options={employees.map((emp) => ({
                  value: emp.id,
                  label: `${emp.full_name}${emp.emp_code ? ` (${emp.emp_code})` : ''}`,
                }))}
                value={selectedEmployee?.id || ''}
                onChange={handleSelectEmployee}
                mode="single"
                searchable={true}
                searchPlaceholder="Search employee..."
                placeholder="Select Employee"
              />
            </div>
          )}

          {/* Readable Summary Chips */}
          <div className="attendance-summary-pills">
            <span className="attendance-summary-pill">
              Days {employeeCounts.total}
            </span>
            <span className="attendance-summary-pill attendance-summary-pill--present">
              Present {employeeCounts.present}
            </span>
            <span className="attendance-summary-pill attendance-summary-pill--weekoff">
              WO {employeeCounts.weekOff}
            </span>
            <span className="attendance-summary-pill attendance-summary-pill--leave">
              Leave {employeeCounts.leave}
            </span>
            <span className="attendance-summary-pill attendance-summary-pill--absent">
              Absent/NS {employeeCounts.absent}
            </span>
            <span className="attendance-summary-pill attendance-summary-pill--null">
              Not Marked {employeeCounts.nullCount}
            </span>
          </div>

          <div className="attendance-mobile-list__items">
            {selectedEmployee && dateRange.map((date) => {
              const record = getCellData(selectedEmployee.id, date);
              const status = record?.attendance_status || 'null';
              const meta = ATTENDANCE_STATUS_META[status] || ATTENDANCE_STATUS_META['null'];
              const hasPendingEdit = !!record?.has_pending_edit;
              const shiftType = record?.shift_type;
              const readableLabel = formatAttendanceStatusLabel(status, shiftType);
              const loginStr = formatTimeShort(record?.first_login_time);
              const logoutStr = formatTimeShort(record?.logout_time);

              return (
                <div
                  key={date}
                  className={`attendance-list-item ${meta.mobileClass} ${
                    hasPendingEdit ? 'attendance-list-item--has-pending' : ''
                  }`}
                  onClick={() => onCellClick(selectedEmployee.id, date)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="attendance-list-item__emp-col">
                    <div className="attendance-list-item__date">
                      {formatFullDate(date)}
                      {date === todayStr && (
                        <span className="attendance-list-item__today-tag">Today</span>
                      )}
                    </div>
                    {loginStr && (
                      <div className="attendance-list-item__time">
                        {loginStr}{logoutStr ? ` – ${logoutStr}` : ''}
                      </div>
                    )}
                  </div>
                  <div className="attendance-list-item__details">
                    <span className="attendance-list-item__status-label u-flex-center-gap-4">
                      {renderStatusIcon(status, shiftType)}
                      <span>{readableLabel}</span>
                    </span>
                    {hasPendingEdit && (
                      <span className="attendance-list-item__pending-badge">⚠ Pending</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default AttendanceMobileList;
