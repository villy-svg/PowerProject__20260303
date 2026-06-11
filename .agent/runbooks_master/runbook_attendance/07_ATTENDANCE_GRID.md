# Phase 3.2 — Attendance Grid Component

## Skills Required (Read Before Starting)
- `development-best-practices` §4 (Strict modularity — keep this component focused on rendering only)
- `safe-code-modification` §2 (CSS integrity — no inline styles, use design system variables)
- `ui-design-system` §3 (Badge system for status cells)
- `ui-design-system` §11 (Small laptop responsiveness — use `.responsive-table-wrapper`)

---

## Objective

Create `AttendanceGrid.jsx` — a **pure presentational component** that renders the Y-axis (employees) × X-axis (dates) grid. It receives all data via props from the Board Shell and emits cell click events upward. No data fetching happens here.

---

## Grid Design Specification

```
┌─────────────────┬──────────┬──────────┬──────────┐
│ Employee        │ Mon 9 Jun│ Tue 10   │ Wed 11   │
├─────────────────┼──────────┼──────────┼──────────┤
│ John Doe        │ 🟢 P     │ 🟡 L     │ 🔴 A ⚠️  │
│ [EMP001] HUB-01 │ Day      │          │          │
├─────────────────┼──────────┼──────────┼──────────┤
│ Jane Smith      │ ⬜ WO    │ 🟢 P     │ 🟢 P     │
│ [EMP002] HUB-02 │          │ Night    │ Day      │
└─────────────────┴──────────┴──────────┴──────────┘
```

### Cell Color Mapping
| Status | Color Token | CSS Class |
|---|---|---|
| `present` | `var(--attendance-present)` | `.attendance-cell--present` |
| `week-off` | `var(--attendance-week-off)` | `.attendance-cell--week-off` |
| `leave` | `var(--attendance-leave)` | `.attendance-cell--leave` |
| `absent` | `var(--attendance-absent)` | `.attendance-cell--absent` |
| `pending` badge | `var(--attendance-pending)` | `.attendance-cell__pending-badge` |

> Color tokens are defined in `EmployeeAttendanceBoard.css` (Phase 5.2 runbook). The CSS class names are the contract between this component and the stylesheet.

---

## Step 1: Create `AttendanceGrid.jsx`

**File to create:**
```
src/verticals/Employees/attendance/AttendanceGrid.jsx
```

**Full JSX Content:**

```jsx
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

  return (
    <td
      className={`attendance-cell ${meta.className} ${hasPendingEdit ? 'attendance-cell--has-pending' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      aria-label={`Status: ${status}${hasPendingEdit ? ', has pending edit' : ''}`}
    >
      <span className="attendance-cell__status-label">{meta.label}</span>
      {/* Shift type sub-label — only shown when present */}
      {shiftType && (
        <span className="attendance-cell__shift-type">
          {shiftType === 'day' ? '☀' : '🌙'}
        </span>
      )}
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
```

---

## Validation Checklist

- [ ] `AttendanceGrid.jsx` created in `src/verticals/Employees/attendance/`
- [ ] `STATUS_META` lookup used (no `if/else` chain for status → class mapping)
- [ ] `AttendanceCell` has `role="button"` and `onKeyDown` for keyboard accessibility
- [ ] `EmployeeRowHeader` renders `emp_code` with `hub-badge` class (from design system)
- [ ] Wrapped in `responsive-table-wrapper` for horizontal scroll on small screens
- [ ] `SkeletonRow` renders when `isLoading === true`
- [ ] Empty state renders when `employees.length === 0` and not loading
- [ ] NO inline styles for colors, padding, or backgrounds anywhere in this file
- [ ] `formatDateHeader` uses `'T00:00:00'` suffix to prevent UTC date shift

---

## DO NOT Proceed to Phase 3.3 Until All Items Above Are Checked.
