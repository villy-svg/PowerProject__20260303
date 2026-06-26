/**
 * EmployeeAttendanceBoard.jsx
 *
 * Manager-facing Attendance Board. Renders a date-range grid of employee
 * attendance status with Maker-Checker approval indicators.
 *
 * Role-based behavior:
 *   - Contributor: clicking a cell opens SuggestEditModal (Maker) or Week Off Planner
 *   - Editor/Admin: sees the pending approval queue drawer + plan approval drawer
 *                   + can approve/reject individual edits AND bulk week-off plans
 *
 * Skill compliance:
 *   rbac-security-system §2 (UI Guards on all actions)
 *   master-header-system (MasterPageHeader with leftActions/rightActions)
 *   development-best-practices §4 (Strict modularity — sub-components below)
 *   ui-design-system §2 (halo-button for all action buttons)
 *   safe-code-modification §1C (Documentation for all logic)
 */

import React, { useState, useEffect, useCallback } from 'react';
import MasterPageHeader from '../../components/layout/MasterPageHeader';
import { useAttendanceBoard } from '../../hooks/useAttendanceBoard';
import { useWeekOffPlanner } from '../../hooks/useWeekOffPlanner';
import AttendanceGrid from './attendance/AttendanceGrid';
import AttendanceMobileList from './attendance/AttendanceMobileList';
import AttendanceLegend from './attendance/AttendanceLegend';
import AttendanceApprovalDrawer from './attendance/AttendanceApprovalDrawer';
import AttendanceSuggestEditModal from './attendance/AttendanceSuggestEditModal';
import WeekOffPlannerModal from './attendance/WeekOffPlannerModal';
import WeekOffPlanApprovalDrawer from './attendance/WeekOffPlanApprovalDrawer';
import './EmployeeAttendanceBoard.css';
import './attendance/AttendanceMobileList.css';
import RBACManageButton from '../../components/ui/RBACManageButton';
import { useLayoutShell } from '../../app/shells/useLayoutShell';
import { IconChevronRight, IconChevronDown } from '../../components/ui/Icons';

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
  verticals,
  activeVertical,
}) => {
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
  } = useAttendanceBoard(user);

  const { shellType } = useLayoutShell();

  // Determine if this user can approve (editor or admin) — used below and by planner
  // NOTE: declared here (before hook usage) because useWeekOffPlanner needs it
  const canApprove    = permissions?.canUpdate || permissions?.canUpdateEmployeeAttendanceBoard;
  // Determine if this user can suggest edits (contributor or above)
  const canSuggestEdit = permissions?.canCreate || permissions?.canCreateEmployeeAttendanceBoard;

  // Week Off Planner hook (fetches planner state; refreshes on mount)
  const planner = useWeekOffPlanner({ user, canApprove });

  // Legend toggle state (persisted in localStorage, defaults to true)
  const [isLegendOpen, setIsLegendOpen] = useState(() => {
    const saved = localStorage.getItem('attendance-board-legend-open');
    return saved !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('attendance-board-legend-open', isLegendOpen);
  }, [isLegendOpen]);

  // Modal/Drawer state
  const [selectedCell,             setSelectedCell]             = useState(null); // { employeeId, date, record }
  const [isApprovalDrawerOpen,     setIsApprovalDrawerOpen]     = useState(false);
  // Week Off Planner modal (contributor/editor — submit a plan)
  const [isPlannerOpen,            setIsPlannerOpen]            = useState(false);
  // Week Off Plan Approval drawer (editor only — approve/reject pending plans)
  const [isPlanApprovalDrawerOpen, setIsPlanApprovalDrawerOpen] = useState(false);

  // Local state for date inputs to prevent continuous re-rendering
  const [inputStart, setInputStart] = useState(startDate);
  const [inputEnd, setInputEnd] = useState(endDate);

  // NOTE: canApprove and canSuggestEdit are declared above (before useWeekOffPlanner)

  // ---------------------------------------------------------------------------
  // Cell click handler
  // ---------------------------------------------------------------------------
  const handleCellClick = useCallback((employeeId, date) => {
    const record = getCellData(employeeId, date);
    setSelectedCell({ employeeId, date, record });

    if (canApprove && record.has_pending_edit) {
      setIsApprovalDrawerOpen(true);
    } else if (canSuggestEdit) {
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

  // Guard: RBAC access check (hard gate per rbac-security-system §3)
  if (!permissions?.canAccessEmployeeAttendanceBoard) {
    return (
      <div className="attendance-board__no-access">
        <p>You do not have access to the Attendance Board.</p>
      </div>
    );
  }

  // Header Actions (per master-header-system §4 alignment rules)
  // ---------------------------------------------------------------------------
  const handleApplyDates = () => {
    setStartDate(inputStart);
    setEndDate(inputEnd);
  };

  const headerLeftActions = (
    <div className="attendance-board__left-actions">
      {shellType !== 'mobile' && (
        <button
          className={`halo-button menu-trigger-btn legend-trigger-btn ${isLegendOpen ? 'active' : ''}`}
          onClick={() => setIsLegendOpen(!isLegendOpen)}
          aria-label="Toggle Legend"
        >
          <span className="menu-icon">
            {isLegendOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </span>
          LEGEND
        </button>
      )}
      <div className="attendance-board__date-range">
        {/* Date range pickers — leftActions = "how I see the data" */}
        <label className="attendance-board__date-label" htmlFor="att-start-date">From</label>
        <input
          id="att-start-date"
          type="date"
          className="attendance-board__date-input"
          value={inputStart}
          onChange={(e) => setInputStart(e.target.value)}
          max={inputEnd}
        />
        <span className="attendance-board__date-separator">→</span>
        <label className="attendance-board__date-label" htmlFor="att-end-date">To</label>
        <input
          id="att-end-date"
          type="date"
          className="attendance-board__date-input"
          value={inputEnd}
          onChange={(e) => setInputEnd(e.target.value)}
          min={inputStart}
        />
        <button 
          className="halo-button halo-button--primary attendance-board__go-btn" 
          onClick={handleApplyDates}
          aria-label="Apply Dates"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </div>
  );

  const headerRightActions = (
    <>
      {/* Week Off Planner button — visible to contributors and editors */}
      {canSuggestEdit && (
        <button
          id="att-board-planner-btn"
          className="halo-button master-action-btn"
          onClick={() => setIsPlannerOpen(true)}
          title="Plan week-offs for all employees up to 15 days ahead. Submit for Editor approval. Contributors can save drafts and resubmit rejected plans."
        >
          📅 Week Off Planner
        </button>
      )}

      {/* Pending Plans badge — editor: approve/reject bulk week-off plans */}
      {canApprove && !!planner.pendingPlansCount && (
        <button
          id="att-board-plan-approval-btn"
          className="halo-button attendance-board__approval-btn"
          onClick={() => setIsPlanApprovalDrawerOpen(true)}
          title="Editors can approve or reject bulk week-off plans submitted by Contributors and other Editors."
        >
          {!!planner.pendingPlansCount && (
            <span className="attendance-board__pending-badge">
              {planner.pendingPlansCount}
            </span>
          )}
          Pending Plans
        </button>
      )}

      {/* Individual edit request approval queue badge — editors only */}
      {canApprove && !!pendingRequests.length && (
        <button
          id="att-board-approval-btn"
          className="halo-button attendance-board__approval-btn"
          onClick={() => setIsApprovalDrawerOpen(true)}
          title="Review individual attendance edit requests from Contributors."
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
      {/* Master Admin: Manage RBAC for Attendance Board and Week Off Planner */}
      <RBACManageButton 
        user={user} 
        verticalId="employees" 
        featureId="canAccessEmployeeAttendanceBoard" 
        label="Attendance Board" 
        title="Configure who can access the Attendance Board, submit week-off plans (Contributor), and approve/reject plans (Editor)."
      />
    </>
  );

  return (
    <div className="attendance-board__wrapper">
      {/* Master Page Header (master-header-system compliance) */}
      <MasterPageHeader
        title="Attendance Board"
        description={
          <span>
            Daily log for employee shifts, check-ins, and leave tracking.
            {/* ⓘ info icon with tooltip about the planner and roles */}
            <span
              className="attendance-board__info-icon"
              title="Week Off Planner: Contributors can submit bulk week-off requests for up to 15 days. Editors approve or reject the plan. Approved plans lock to the standard single-cell edit flow."
              aria-label="Attendance Board info"
            >
              ⓘ
            </span>
          </span>
        }
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        isSubSidebarOpen={isSubSidebarOpen}
        onSidebarToggle={setIsSubSidebarOpen}
        hideMenuClose={true}
        SidebarComponent={SidebarComponent}
        user={user}
        permissions={permissions}
        verticals={verticals}
        activeVertical={activeVertical}
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

      {/* Legend (Desktop Only) */}
      {shellType !== 'mobile' && isLegendOpen && (
        <div className="attendance-board__legend-wrapper">
          <AttendanceLegend />
        </div>
      )}

      {/* Main Content: Adaptive swapping between Grid and List */}
      {shellType === 'mobile' ? (
        <AttendanceMobileList
          employees={employees}
          dateRange={dateRange}
          getCellData={getCellData}
          isLoading={isLoading}
          onCellClick={handleCellClick}
          dateFilterControl={headerLeftActions}
        />
      ) : (
        <AttendanceGrid
          employees={employees}
          dateRange={dateRange}
          getCellData={getCellData}
          isLoading={isLoading}
          onCellClick={handleCellClick}
        />
      )}

      {/* Editor: Individual edit request Approval Drawer */}
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

      {/* Contributor: Suggest Edit Modal (single-cell edit flow) */}
      {selectedCell && !isApprovalDrawerOpen && canSuggestEdit && (
        <AttendanceSuggestEditModal
          selectedCell={selectedCell}
          currentUser={user}
          onClose={handleCloseModal}
          onSubmitComplete={handleActionComplete}
        />
      )}

      {/* Contributor/Editor: Week Off Planner Modal */}
      {isPlannerOpen && (
        <WeekOffPlannerModal
          user={user}
          employees={employees}
          planner={planner}
          onClose={() => setIsPlannerOpen(false)}
          onPlanSaved={() => {
            planner.refreshPlanner();
            refreshBoard();
          }}
        />
      )}

      {/* Editor: Bulk Plan Approval Drawer */}
      {isPlanApprovalDrawerOpen && (
        <WeekOffPlanApprovalDrawer
          isOpen={isPlanApprovalDrawerOpen}
          planner={planner}
          currentUser={user}
          onClose={() => setIsPlanApprovalDrawerOpen(false)}
          onActionComplete={() => {
            setIsPlanApprovalDrawerOpen(false);
            planner.refreshPlanner();
            refreshBoard();
          }}
        />
      )}
    </div>
  );
};

export default EmployeeAttendanceBoard;
