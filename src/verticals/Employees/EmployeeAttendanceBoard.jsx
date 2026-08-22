/**
 * EmployeeAttendanceBoard.jsx
 *
 * Manager-facing Attendance Board and Week Off Planner.
 * Renders a date-range grid of employee attendance status.
 *
 * Role-based behavior:
 *   - Contributor: clicking a cell opens SuggestEditModal (Maker) or toggles draft in Planner mode.
 *   - Editor/Admin: sees the pending approval queue drawers + can approve/reject.
 *
 * Skill compliance:
 *   rbac-security-system §2 (UI Guards on all actions)
 *   master-header-system (MasterPageHeader with leftActions/rightActions)
 *   development-best-practices §4 (Strict modularity)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useAttendanceBoard } from '../../hooks/useAttendanceBoard';
import { useSchedulePlanner } from '../../hooks/useSchedulePlanner';
import AttendanceGrid from './attendance/AttendanceGrid';
import AttendanceMobileList from './attendance/AttendanceMobileList';
import AttendanceApprovalDrawer from './attendance/AttendanceApprovalDrawer';
import AttendanceSuggestEditModal from './attendance/AttendanceSuggestEditModal';
import SchedulePlanApprovalDrawer from './attendance/SchedulePlanApprovalDrawer';
import ScheduleMyPlansDrawer from './attendance/ScheduleMyPlansDrawer';
import AttendanceBoardHeader from './attendance/components/AttendanceBoardHeader';
import './EmployeeAttendanceBoard.css';
import './attendance/AttendanceMobileList.css';
import { useLayoutShell } from '../../app/shells/useLayoutShell';

import { useHubs } from './attendance/hooks/useHubs';
import { useScheduleDrafting } from './attendance/hooks/useScheduleDrafting';



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
  const {
    employees, dateRange: attendanceDateRange, startDate, setStartDate,
    endDate, setEndDate, pendingRequests, isLoading: isBoardLoading,
    error, refreshBoard, getCellData: getLiveCellData,
    page, setPage, hasMore
  } = useAttendanceBoard(user);

  const { shellType } = useLayoutShell();

  const canApprove = permissions?.canUpdate || permissions?.canUpdateEmployeeAttendanceBoard;
  const canSuggestEdit = permissions?.canCreate || permissions?.canCreateEmployeeAttendanceBoard;

  const planner = useSchedulePlanner({ user, canApprove });

  // --- UI View Mode State ---
  const [viewMode, setViewMode] = useState('attendance'); // 'attendance' | 'planner'
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // --- Drawers & Modals & Views ---
  const [selectedCell, setSelectedCell] = useState(null);
  
  // Replace boolean drawers with setting the viewMode
  // viewMode can now be 'attendance' | 'planner' | 'pending-requests' | 'pending-plans'
  const [showMyPlans, setShowMyPlans] = useState(false);

  const {
    weekString, setWeekString,
    activePlanId,
    employeeSelections,
    isSubmittingPlanner,
    plannerError, setPlannerError,
    plannerSuccess, setPlannerSuccess,
    paintbrushStatus, setPaintbrushStatus,
    paintbrushHubId, setPaintbrushHubId,
    activeCellEdit, setActiveCellEdit,
    plannerDateFrom, plannerDateTo,
    plannerDateRange,
    totalEntries,
    handleCellClick: draftHandleCellClick,
    handleCellChange: draftHandleCellChange,
    handleSaveDraft,
    handleSubmitForApproval,
    loadPlanIntoGrid,
  } = useScheduleDrafting({ planner, getLiveCellData, refreshBoard });

  const activeDateRange = viewMode === 'planner' ? plannerDateRange : attendanceDateRange;
  
  // Custom cell data provider that overrides the live database when in planner mode
  const getCellData = useCallback((empId, date) => {
    if (viewMode === 'planner') {
      const liveData = getLiveCellData(empId, date);
      const isAlreadyMarked = liveData && !liveData.is_scheduled_only && liveData.attendance_status !== 'null';
      
      if (isAlreadyMarked) {
        // Return this so already marked attendance displays in the planner grid
        return { ...liveData, is_draft: false };
      }

      const selections = employeeSelections[empId] || {};
      const sel = selections[date];
      if (sel) {
        return { attendance_status: sel.attendance_status, hub_id: sel.hub_id, is_draft: true, shift_date: date, employee_id: empId };
      }
      return { attendance_status: null, shift_date: date, employee_id: empId };
    }
    return getLiveCellData(empId, date);
  }, [viewMode, employeeSelections, getLiveCellData]);

  // Grid Cell Click
  const handleCellClick = useCallback((empId, date) => {
    if (viewMode === 'planner') {
      draftHandleCellClick(empId, date);
      return;
    }

    // Normal Attendance Mode
    const record = getCellData(empId, date);
    const emp = employees.find(e => e.id === empId);
    const employeeName = emp?.full_name || emp?.name || 'Unknown Employee';
    setSelectedCell({ employeeId: empId, date, record, employeeName });
    if (canApprove && record.has_pending_edit) {
      setViewMode('pending-requests');
    } else if (canSuggestEdit) {
      // Just open suggest edit modal, don't change viewMode
    }
  }, [viewMode, getCellData, canApprove, canSuggestEdit, draftHandleCellClick, employees]);

  const handleCellChange = useCallback((empId, date, newStatus, newHubId) => {
    draftHandleCellChange(empId, date, newStatus, newHubId);
  }, [draftHandleCellChange]);

  const handleCloseModal = useCallback(() => {
    setSelectedCell(null);
    setViewMode('attendance');
  }, []);

  const handleActionComplete = useCallback(() => {
    handleCloseModal();
    refreshBoard();
  }, [handleCloseModal, refreshBoard]);

  // --- ATTENDANCE DATE PICKERS ---
  const [inputStart, setInputStart] = useState(startDate);
  const [inputEnd, setInputEnd] = useState(endDate);

  const parsedStart = useMemo(() => inputStart ? new Date(inputStart + 'T00:00:00') : null, [inputStart]);
  const parsedEnd = useMemo(() => inputEnd ? new Date(inputEnd + 'T00:00:00') : null, [inputEnd]);

  const handleRangeChange = (dates) => {
    const [start, end] = dates;
    
    if (start) {
      const dStart = new Date(start);
      dStart.setMinutes(dStart.getMinutes() - dStart.getTimezoneOffset());
      setInputStart(dStart.toISOString().split('T')[0]);
    } else {
      setInputStart('');
    }

    if (end) {
      const dEnd = new Date(end);
      dEnd.setMinutes(dEnd.getMinutes() - dEnd.getTimezoneOffset());
      setInputEnd(dEnd.toISOString().split('T')[0]);
    } else {
      setInputEnd('');
    }
  };

  const handleApplyDates = () => {
    setStartDate(inputStart);
    setEndDate(inputEnd);
    if (setPage) setPage(1); // Reset page on date change
  };

  // Guard: RBAC access check
  if (!permissions?.canAccessEmployeeAttendanceBoard) {
    return (
      <div className="attendance-board__no-access">
        <p>You do not have access to the Attendance Board.</p>
      </div>
    );
  }

  return (
    <div className="attendance-board__wrapper">
      <AttendanceBoardHeader
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        isSubSidebarOpen={isSubSidebarOpen}
        setIsSubSidebarOpen={setIsSubSidebarOpen}
        SidebarComponent={SidebarComponent}
        verticals={verticals}
        activeVertical={activeVertical}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        setShowMyPlans={setShowMyPlans}
        parsedStart={parsedStart}
        parsedEnd={parsedEnd}
        handleRangeChange={handleRangeChange}
        handleApplyDates={handleApplyDates}
        page={page}
        setPage={setPage}
        hasMore={hasMore}
        isBoardLoading={isBoardLoading}
        refreshBoard={refreshBoard}
        planner={planner}
        activePlanId={activePlanId}
        setActivePlanId={setActivePlanId}
        weekString={weekString}
        setWeekString={setWeekString}
        plannerDateFrom={plannerDateFrom}
        setEmployeeSelections={setEmployeeSelections}
        totalEntries={totalEntries}
        isSubmittingPlanner={isSubmittingPlanner}
        paintbrushStatus={paintbrushStatus}
        setPaintbrushStatus={setPaintbrushStatus}
        paintbrushHubId={paintbrushHubId}
        setPaintbrushHubId={setPaintbrushHubId}
        handleSaveDraft={handleSaveDraft}
        handleSubmitForApproval={handleSubmitForApproval}
        hubs={hubs}
        canApprove={canApprove}
        canSuggestEdit={canSuggestEdit}
      />

      {/* Notifications */}
      {/* Error state */}
      {viewMode === 'attendance' && error && (
        <div className="attendance-board__error">
          <p>⚠ {error}</p>
        </div>
      )}

      {viewMode === 'planner' && (
        <>
          {plannerError && (
            <div className="attendance-board__planner-msg attendance-board__planner-msg--error">
              <p>⚠ {plannerError}</p>
            </div>
          )}
          {plannerSuccess && (
            <div className="attendance-board__planner-msg attendance-board__planner-msg--success">
              <p>✓ {plannerSuccess}</p>
            </div>
          )}
        </>
      )}

      {/* Main Grid Content */}
      {viewMode === 'pending-requests' ? (
        <AttendanceApprovalDrawer
          isOpen={true}
          selectedCell={selectedCell}
          pendingRequests={pendingRequests}
          currentUser={user}
          onClose={handleCloseModal}
          onActionComplete={handleActionComplete}
        />
      ) : viewMode === 'pending-plans' ? (
        <SchedulePlanApprovalDrawer
          isOpen={true}
          planner={planner}
          currentUser={user}
          onClose={() => setViewMode('attendance')}
          onActionComplete={() => {
            setViewMode('attendance');
            planner.refreshPlanner();
            refreshBoard();
          }}
        />
      ) : shellType === 'mobile' ? (
        <AttendanceMobileList
          employees={employees}
          dateRange={activeDateRange}
          getCellData={getCellData}
          isLoading={viewMode === 'attendance' ? isBoardLoading : false}
          onCellClick={handleCellClick}
          dateFilterControl={headerLeftActions}
        />
      ) : (
        <AttendanceGrid
          employees={employees}
          dateRange={activeDateRange}
          getCellData={getCellData}
          isLoading={viewMode === 'attendance' ? isBoardLoading : false}
          onCellClick={handleCellClick}
          activeCellEdit={activeCellEdit}
          onCellChange={handleCellChange}
          hubs={hubs}
          groupByHub={viewMode === 'planner'}
        />
      )}

      {/* Modals and Drawers */}
      {selectedCell && viewMode === 'attendance' && canSuggestEdit && (
        <AttendanceSuggestEditModal
          selectedCell={selectedCell}
          currentUser={user}
          onClose={handleCloseModal}
          onSubmitComplete={handleActionComplete}
        />
      )}

      {showMyPlans && (
        <ScheduleMyPlansDrawer
          isOpen={showMyPlans}
          planner={planner}
          onClose={() => setShowMyPlans(false)}
          onLoadPlan={loadPlanIntoGrid}
        />
      )}
    </div>
  );
};

export default EmployeeAttendanceBoard;
