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
import RBACManageButton from '../../components/RBACManageButton';

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
      {/* Master Admin: Manage RBAC for Attendance Board */}
      <RBACManageButton 
        user={user} 
        verticalId="employees" 
        featureId="canAccessEmployeeAttendanceBoard" 
        label="Attendance Board" 
      />
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
