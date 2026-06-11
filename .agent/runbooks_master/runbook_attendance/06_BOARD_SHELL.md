# Phase 3.1 — Board Shell & Header

## Skills Required (Read Before Starting)
- `safe-code-modification` §1A (Do No Harm — this REPLACES the stub, but safely)
- `master-header-system` — `MasterPageHeader` usage and props
- `development-best-practices` §4 (Avoid God Components — break into sub-components)
- `ui-design-system` §2 (`.halo-button` for all action buttons)
- `rbac-security-system` §2 (UI Guards — permissions.canAccessEmployeeAttendanceBoard)

---

## Objective

Replace the empty stub in `EmployeeAttendanceBoard.jsx` with a fully structured shell that:
1. Validates RBAC access
2. Shows a `MasterPageHeader` with date-range pickers + action buttons
3. Conditionally renders the Attendance Grid or the Approvals Drawer based on user role
4. Routes editor clicks on pending cells to the ApprovalReviewModal
5. Routes contributor clicks to the SuggestEditModal

**This is a FULL REWRITE of the stub file. The stub has no logic to preserve.**

---

## Component Tree for the Attendance Board

```
EmployeeAttendanceBoard.jsx          ← This runbook (shell + orchestration)
  ├── AttendanceGrid.jsx             ← Phase 3.2 (grid + cell rendering)
  ├── AttendanceApprovalDrawer.jsx   ← Phase 3.3 (editor approval queue)
  ├── AttendanceSuggestEditModal.jsx ← Phase 3.4 (contributor suggest edit)
  └── AttendanceCellDetail.jsx       ← (inline — simple presentational)
```

---

## Step 1: Rewrite `EmployeeAttendanceBoard.jsx`

**File to modify (FULL REPLACE of stub):**
```
src/verticals/Employees/EmployeeAttendanceBoard.jsx
```

**Full JSX Content:**

```jsx
/**
 * EmployeeAttendanceBoard.jsx
 *
 * Manager-facing Attendance Board. Renders a date-range grid of employee
 * attendance status with Maker-Checker approval indicators.
 *
 * Role-based behavior:
 *   - Contributor: clicking a cell opens SuggestEditModal (Maker)
 *   - Editor/Admin: sees the pending approval queue drawer + can approve/reject
 *
 * Skill compliance:
 *   rbac-security-system §2 (UI Guards on all actions)
 *   master-header-system (MasterPageHeader with leftActions/rightActions)
 *   development-best-practices §4 (Strict modularity — sub-components below)
 *   ui-design-system §2 (halo-button for all action buttons)
 *   safe-code-modification §1C (Documentation for all logic)
 */

import React, { useState, useCallback } from 'react';
import MasterPageHeader from '../../components/MasterPageHeader';
import { useAttendanceBoard } from '../../hooks/useAttendanceBoard';
import AttendanceGrid from './attendance/AttendanceGrid';
import AttendanceApprovalDrawer from './attendance/AttendanceApprovalDrawer';
import AttendanceSuggestEditModal from './attendance/AttendanceSuggestEditModal';
import './EmployeeAttendanceBoard.css';

// ---------------------------------------------------------------------------
// Helper: Format a 'YYYY-MM-DD' string for display as an <input type="date">
// value. No transformation needed — ISO date string is the native input format.
// ---------------------------------------------------------------------------

const EmployeeAttendanceBoard = ({
  user,
  permissions,
  setActiveVertical,
  onShowBottomNav,
  isSubSidebarOpen,
  setIsSubSidebarOpen,
  SidebarComponent,
}) => {
  // Guard: RBAC access check (hard gate per rbac-security-system §3)
  if (!permissions?.canAccessEmployeeAttendanceBoard) {
    return (
      <div className="attendance-board__no-access">
        <p>You do not have access to the Attendance Board.</p>
      </div>
    );
  }

  // Board data hook
  const {
    employees,
    dateRange,
    startDate, setStartDate,
    endDate, setEndDate,
    pendingRequests,
    isLoading,
    error,
    refreshBoard,
    getCellData,
  } = useAttendanceBoard();

  // Modal/Drawer state
  const [selectedCell, setSelectedCell] = useState(null);    // { employeeId, date, record }
  const [isApprovalDrawerOpen, setIsApprovalDrawerOpen] = useState(false);

  // Determine if this user can approve (editor or admin)
  const canApprove = permissions?.canUpdate || permissions?.canUpdateEmployeeAttendanceBoard;
  // Determine if this user can suggest edits (contributor or above)
  const canSuggestEdit = permissions?.canCreate || permissions?.canCreateEmployeeAttendanceBoard;

  // ---------------------------------------------------------------------------
  // Cell click handler — behavior differs by role:
  //   Editor/Admin: if cell has pending edit, open approval drawer. Otherwise suggest.
  //   Contributor:  always open suggest edit modal.
  // ---------------------------------------------------------------------------
  const handleCellClick = useCallback((employeeId, date) => {
    const record = getCellData(employeeId, date);
    setSelectedCell({ employeeId, date, record });

    if (canApprove && record.has_pending_edit) {
      setIsApprovalDrawerOpen(true);
    } else if (canSuggestEdit) {
      // SuggestEditModal opens via selectedCell !== null AND drawer not open
      setIsApprovalDrawerOpen(false);
    }
  }, [canApprove, canSuggestEdit, getCellData]);

  const handleCloseModal = useCallback(() => {
    setSelectedCell(null);
    setIsApprovalDrawerOpen(false);
  }, []);

  const handleActionComplete = useCallback(() => {
    handleCloseModal();
    refreshBoard();
  }, [handleCloseModal, refreshBoard]);

  // ---------------------------------------------------------------------------
  // Header Actions (per master-header-system §4 alignment rules)
  // ---------------------------------------------------------------------------
  const headerLeftActions = (
    <div className="attendance-board__date-range">
      {/* Date range pickers — leftActions = "how I see the data" */}
      <label className="attendance-board__date-label" htmlFor="att-start-date">From</label>
      <input
        id="att-start-date"
        type="date"
        className="attendance-board__date-input"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        max={endDate}
      />
      <span className="attendance-board__date-separator">→</span>
      <label className="attendance-board__date-label" htmlFor="att-end-date">To</label>
      <input
        id="att-end-date"
        type="date"
        className="attendance-board__date-input"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        min={startDate}
      />
    </div>
  );

  const headerRightActions = (
    <>
      {/* Approval queue badge — only shown to editors */}
      {canApprove && !!pendingRequests.length && (
        <button
          id="att-board-approval-btn"
          className="halo-button attendance-board__approval-btn"
          onClick={() => setIsApprovalDrawerOpen(true)}
        >
          {/* Badge count (truthy check avoids rendering 0) */}
          {!!pendingRequests.length && (
            <span className="attendance-board__pending-badge">
              {pendingRequests.length}
            </span>
          )}
          Pending Approvals
        </button>
      )}
      <button
        id="att-board-refresh-btn"
        className="halo-button master-action-btn"
        onClick={refreshBoard}
        disabled={isLoading}
      >
        {isLoading ? 'Loading…' : 'Refresh'}
      </button>
    </>
  );

  return (
    <>
      {/* Master Page Header (master-header-system compliance) */}
      <MasterPageHeader
        title="Attendance Board"
        description="Daily log for employee shifts, check-ins, and leave tracking."
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        isSubSidebarOpen={isSubSidebarOpen}
        onSidebarToggle={setIsSubSidebarOpen}
        hideMenuClose={true}
        SidebarComponent={SidebarComponent}
        user={user}
        permissions={permissions}
        leftActions={headerLeftActions}
        rightActions={headerRightActions}
      />

      {/* Error State */}
      {error && (
        <div className="attendance-board__error">
          <p>⚠ {error}</p>
          <button className="halo-button" onClick={refreshBoard}>Retry</button>
        </div>
      )}

      {/* Legend */}
      <div className="attendance-board__legend">
        <span className="attendance-board__legend-item attendance-board__legend--present">Present</span>
        <span className="attendance-board__legend-item attendance-board__legend--week-off">Week-Off</span>
        <span className="attendance-board__legend-item attendance-board__legend--leave">Leave</span>
        <span className="attendance-board__legend-item attendance-board__legend--absent">Absent</span>
        <span className="attendance-board__legend-item attendance-board__legend--pending">⚠ Pending Edit</span>
      </div>

      {/* Main Grid */}
      <AttendanceGrid
        employees={employees}
        dateRange={dateRange}
        getCellData={getCellData}
        isLoading={isLoading}
        onCellClick={handleCellClick}
      />

      {/* Editor: Approval Drawer */}
      {isApprovalDrawerOpen && (
        <AttendanceApprovalDrawer
          isOpen={isApprovalDrawerOpen}
          selectedCell={selectedCell}
          pendingRequests={pendingRequests}
          currentUser={user}
          onClose={handleCloseModal}
          onActionComplete={handleActionComplete}
        />
      )}

      {/* Contributor: Suggest Edit Modal */}
      {selectedCell && !isApprovalDrawerOpen && canSuggestEdit && (
        <AttendanceSuggestEditModal
          selectedCell={selectedCell}
          currentUser={user}
          onClose={handleCloseModal}
          onSubmitComplete={handleActionComplete}
        />
      )}
    </>
  );
};

export default EmployeeAttendanceBoard;
```

---

## Step 2: Create the `attendance/` Sub-Directory

Create the directory:
```
src/verticals/Employees/attendance/
```

All sub-components (Grid, Drawer, Modal) live here. This follows the **colocation architecture** principle from `development-best-practices §9`.

---

## Step 3: Update `index.js` Barrel (Additive Only)

**File to modify:** `src/verticals/Employees/index.js`

**Add this line** (do not remove any existing exports):
```javascript
export { default as EmployeeAttendanceBoard } from './EmployeeAttendanceBoard';
```

> **Note**: The `EmployeeAttendanceBoard` is already imported in `ContentRouter.jsx`. This barrel export is for consistency. No ContentRouter changes are needed.

---

## Validation Checklist

- [ ] `EmployeeAttendanceBoard.jsx` no longer contains the empty placeholder div
- [ ] RBAC guard at the top of the component renders `no-access` if `!permissions?.canAccessEmployeeAttendanceBoard`
- [ ] `useAttendanceBoard` hook imported and used (not inline Supabase calls)
- [ ] `selectedCell` state is only `null` or an object `{ employeeId, date, record }`
- [ ] `canApprove` and `canSuggestEdit` derived from `permissions` object (no hardcoded role strings)
- [ ] Header uses `leftActions` for date pickers and `rightActions` for Refresh + Pending Approvals
- [ ] All buttons use `.halo-button` class (no raw `<button>` with inline styles)
- [ ] `!!pendingRequests.length` used (not `pendingRequests.length`) to prevent rendering `0`
- [ ] `attendance/` subdirectory created

---

## DO NOT Proceed to Phase 3.2 Until All Items Above Are Checked.
