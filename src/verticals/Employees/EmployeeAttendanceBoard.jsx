/**
 * EmployeeAttendanceBoard.jsx
 *
 * Manager-facing Attendance Board.
 * Renders a date-range grid (Desktop) or mobile list + inline mobile control bar (Phone).
 *
 * Role-based behavior:
 *   - Contributor: clicking a cell opens SuggestEditModal (Maker), or uses Multi-Day Update (A.2).
 *   - Editor/Admin: sees the pending approval queue + can approve/reject.
 *
 * TODO(future-rebuild): Bulk Schedule Planner (A.2), SchedulePlanApprovalDrawer (A.4),
 * and ScheduleMyPlansDrawer (A.5) UI were stripped from this shell. External wiring
 * (useSchedulePlanner, schedulePlannerService, useScheduleDrafting, and the two drawers)
 * is intentionally preserved in the repo for future rebuild.
 *
 * Skill compliance:
 *   rbac-security-system §2 (UI Guards on all actions)
 *   master-header-system (MasterPageHeader with leftActions/rightActions)
 *   development-best-practices §4 (Strict modularity)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useAttendanceBoard } from '../../hooks/useAttendanceBoard';
import AttendanceGrid from './attendance/AttendanceGrid';
import AttendanceMobileList from './attendance/AttendanceMobileList';
import AttendanceApprovalDrawer from './attendance/AttendanceApprovalDrawer';
import AttendanceSuggestEditModal from './attendance/AttendanceSuggestEditModal';
import SingleEmployeeBulkUpdateModal from './attendance/SingleEmployeeBulkUpdateModal';
import AttendanceBoardHeader from './attendance/components/AttendanceBoardHeader';
import AttendanceMobileBar from './attendance/components/AttendanceMobileBar';
import {
  toISTDateString,
  shiftDateString,
  getPresetDateRange,
} from './attendance/utils/attendanceDateUtils';
import './EmployeeAttendanceBoard.css';
import './attendance/AttendanceMobileList.css';
import { useLayoutShell } from '../../app/shells/useLayoutShell';

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
    employees, allEmployees, dateRange, startDate, setStartDate,
    endDate, setEndDate, pendingRequests, isLoading: isBoardLoading,
    error, refreshBoard, getCellData,
    page, setPage, hasMore
  } = useAttendanceBoard(user);

  const { shellType } = useLayoutShell();

  const canApprove = permissions?.canUpdate || permissions?.canUpdateEmployeeAttendanceBoard;
  const canSuggestEdit = permissions?.canCreate || permissions?.canCreateEmployeeAttendanceBoard;

  // --- UI View Mode State ---
  // 'attendance' | 'pending-requests'
  // TODO(future-rebuild): 'planner' and 'pending-plans' modes parked per A.2/A.4/A.5.
  const [viewMode, setViewMode] = useState('attendance');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [showMobileDatePicker, setShowMobileDatePicker] = useState(false);

  // --- Employee Search & Desktop Hub Filter State ---
  const [searchedEmployee, setSearchedEmployee] = useState(null);
  const [selectedHubId, setSelectedHubId] = useState('');

  // Derive unique Hub filter options from loaded employees (zero extra DB queries; Desktop-only per C.1)
  const hubOptions = useMemo(() => {
    const map = new Map();
    (allEmployees || []).forEach((emp) => {
      if (emp.hubs?.id) {
        map.set(emp.hubs.id, emp.hubs.hub_code || emp.hubs.name);
      }
    });
    const sorted = Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
    return [{ value: '', label: 'All Hubs' }, ...sorted];
  }, [allEmployees]);

  const handleHubChange = useCallback((hubId) => {
    setSelectedHubId(hubId || '');
    setSearchedEmployee(null);
    setPage(1);
  }, [setPage]);

  // Normalize active employees for records-mode SearchBar (searchable by name, emp_code, dept_code, hub_code)
  const searchRecords = useMemo(() => {
    const source = allEmployees.length > 0 ? allEmployees : employees;
    return source.map(emp => ({
      ...emp,
      dept_code: emp.departments?.dept_code || '',
      hub_code: emp.hubs?.hub_code || '',
    }));
  }, [allEmployees, employees]);

  // Desktop: apply search or Hub filter (paginated 50/page); Mobile: pass full unpaginated list (C.2)
  const desktopFilteredEmployees = useMemo(() => {
    if (searchedEmployee) return [searchedEmployee];
    if (!selectedHubId) return employees;
    const filtered = allEmployees.filter(e => e.hubs?.id === selectedHubId || e.hub_id === selectedHubId);
    const startIdx = (page - 1) * 50;
    return filtered.slice(startIdx, startIdx + 50);
  }, [employees, allEmployees, searchedEmployee, selectedHubId, page]);

  const desktopHasMore = useMemo(() => {
    if (searchedEmployee) return false;
    if (!selectedHubId) return hasMore;
    const filteredCount = allEmployees.filter(e => e.hubs?.id === selectedHubId || e.hub_id === selectedHubId).length;
    return page * 50 < filteredCount;
  }, [allEmployees, searchedEmployee, selectedHubId, page, hasMore]);

  const mobileEmployees = useMemo(() => {
    const base = allEmployees.length > 0 ? allEmployees : employees;
    if (!searchedEmployee) return base;
    const alreadyPresent = base.some(e => e.id === searchedEmployee.id);
    return alreadyPresent ? base : [searchedEmployee, ...base];
  }, [allEmployees, employees, searchedEmployee]);

  const displayedEmployees = shellType === 'mobile' ? mobileEmployees : desktopFilteredEmployees;

  const handleSearchSelect = useCallback((emp) => {
    if (!emp) return;
    setSearchedEmployee(emp);
  }, []);

  const handleMobileSelectEmployee = useCallback((empId) => {
    if (!empId) {
      setSearchedEmployee(null);
      return;
    }
    const found = allEmployees.find(e => e.id === empId) || employees.find(e => e.id === empId);
    if (found) setSearchedEmployee(found);
  }, [allEmployees, employees]);

  const handleSetPage = useCallback((updater) => {
    setSearchedEmployee(null);
    setPage(updater);
  }, [setPage]);

  // --- Modals & Cell Selection ---
  const [selectedCell, setSelectedCell] = useState(null);

  const handleCellClick = useCallback((empId, date) => {
    const record = getCellData(empId, date);
    const emp = displayedEmployees.find(e => e.id === empId) || allEmployees.find(e => e.id === empId);
    const employeeName = emp?.full_name || emp?.name || 'Unknown Employee';
    setSelectedCell({ employeeId: empId, date, record, employeeName });
    if (canApprove && record.has_pending_edit) {
      setViewMode('pending-requests');
    }
  }, [getCellData, canApprove, displayedEmployees, allEmployees]);

  const handleCloseModal = useCallback(() => {
    setSelectedCell(null);
    setViewMode('attendance');
  }, []);

  const handleActionComplete = useCallback(() => {
    handleCloseModal();
    refreshBoard();
  }, [handleCloseModal, refreshBoard]);

  // --- ATTENDANCE DATE PICKERS (Android-8-safe IST serialization) ---
  const [inputStart, setInputStart] = useState(startDate);
  const [inputEnd, setInputEnd] = useState(endDate);

  const parsedStart = useMemo(() => inputStart ? new Date(inputStart + 'T00:00:00') : null, [inputStart]);
  const parsedEnd = useMemo(() => inputEnd ? new Date(inputEnd + 'T00:00:00') : null, [inputEnd]);

  const handleRangeChange = (dates) => {
    const [start, end] = dates;
    setInputStart(start ? toISTDateString(new Date(start)) : '');
    setInputEnd(end ? toISTDateString(new Date(end)) : '');
  };

  const handleApplyDates = () => {
    if (!inputStart || !inputEnd) return;
    setStartDate(inputStart);
    setEndDate(inputEnd);
    setPage(1);
    setShowMobileDatePicker(false);
  };

  // Mobile 1-tap week shift (◀ / ▶)
  const handleShiftWeek = useCallback((deltaDays) => {
    const nextStart = shiftDateString(startDate, deltaDays);
    const nextEnd = shiftDateString(endDate, deltaDays);
    setInputStart(nextStart);
    setInputEnd(nextEnd);
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setPage(1);
  }, [startDate, endDate, setStartDate, setEndDate, setPage]);

  // Quick date presets (This Week / Last 14 Days / Current Month / Last Month)
  const handleApplyPreset = useCallback((preset) => {
    const { startDate: fromStr, endDate: toStr } = getPresetDateRange(preset);
    if (!fromStr || !toStr) return;
    setInputStart(fromStr);
    setInputEnd(toStr);
    setStartDate(fromStr);
    setEndDate(toStr);
    setPage(1);
    setShowMobileDatePicker(false);
  }, [setStartDate, setEndDate, setPage]);

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
        onOpenBulkUpdate={() => setShowBulkUpdateModal(true)}
        parsedStart={parsedStart}
        parsedEnd={parsedEnd}
        handleRangeChange={handleRangeChange}
        handleApplyDates={handleApplyDates}
        onApplyPreset={handleApplyPreset}
        page={page}
        setPage={handleSetPage}
        hasMore={desktopHasMore}
        hubOptions={hubOptions}
        selectedHubId={selectedHubId}
        onHubChange={handleHubChange}
        shellType={shellType}
        isBoardLoading={isBoardLoading}
        refreshBoard={refreshBoard}
        pendingRequestsCount={pendingRequests.length}
        canApprove={canApprove}
        canSuggestEdit={canSuggestEdit}
        searchRecords={searchRecords}
        recordType="Employee"
        onSearchSelect={handleSearchSelect}
      />

      {/* Mobile-Only Inline Control Strip (MobileHeader intentionally omits leftActions/rightActions) */}
      {shellType === 'mobile' && viewMode === 'attendance' && (
        <AttendanceMobileBar
          startDate={startDate}
          endDate={endDate}
          inputStart={inputStart}
          inputEnd={inputEnd}
          setInputStart={setInputStart}
          setInputEnd={setInputEnd}
          showDatePicker={showMobileDatePicker}
          setShowDatePicker={setShowMobileDatePicker}
          onShiftWeek={handleShiftWeek}
          onApplyPreset={handleApplyPreset}
          onApplyDates={handleApplyDates}
          canSuggestEdit={canSuggestEdit}
          canApprove={canApprove}
          pendingRequestsCount={pendingRequests.length}
          isBoardLoading={isBoardLoading}
          onOpenBulkUpdate={() => setShowBulkUpdateModal(true)}
          onOpenApprovals={() => setViewMode('pending-requests')}
          onRefresh={refreshBoard}
        />
      )}

      {/* Active Employee Search Filter Bar (Desktop) */}
      {shellType !== 'mobile' && searchedEmployee && viewMode === 'attendance' && (
        <div className="attendance-board__search-filter-bar">
          <span className="attendance-board__search-filter-label">
            Showing employee:
          </span>
          <span className="attendance-board__search-filter-chip">
            {searchedEmployee.full_name}
            {searchedEmployee.emp_code && (
              <span className="attendance-board__search-filter-code">{searchedEmployee.emp_code}</span>
            )}
          </span>
          <button
            type="button"
            className="halo-button attendance-board__search-filter-clear"
            onClick={() => setSearchedEmployee(null)}
          >
            ✕ Show All
          </button>
        </div>
      )}

      {/* Error state */}
      {viewMode === 'attendance' && error && (
        <div className="attendance-board__error">
          <p>⚠ {error}</p>
        </div>
      )}

      {/* Main Content */}
      {viewMode === 'pending-requests' ? (
        <AttendanceApprovalDrawer
          isOpen={true}
          selectedCell={selectedCell}
          pendingRequests={pendingRequests}
          currentUser={user}
          onClose={handleCloseModal}
          onActionComplete={handleActionComplete}
        />
      ) : shellType === 'mobile' ? (
        <AttendanceMobileList
          employees={displayedEmployees}
          dateRange={dateRange}
          getCellData={getCellData}
          isLoading={isBoardLoading}
          onCellClick={handleCellClick}
          selectedEmployeeId={searchedEmployee?.id || ''}
          onSelectEmployee={handleMobileSelectEmployee}
        />
      ) : (
        <AttendanceGrid
          employees={displayedEmployees}
          dateRange={dateRange}
          getCellData={getCellData}
          isLoading={isBoardLoading}
          onCellClick={handleCellClick}
        />
      )}

      {/* Single-cell Suggest Edit Modal */}
      {selectedCell && viewMode === 'attendance' && canSuggestEdit && (
        <AttendanceSuggestEditModal
          selectedCell={selectedCell}
          currentUser={user}
          onClose={handleCloseModal}
          onSubmitComplete={handleActionComplete}
        />
      )}

      {/* Simplified A.2: Single-employee, multi-day updater */}
      {showBulkUpdateModal && canSuggestEdit && (
        <SingleEmployeeBulkUpdateModal
          employees={allEmployees.length > 0 ? allEmployees : employees}
          dateRange={dateRange}
          getCellData={getCellData}
          initialEmployeeId={searchedEmployee?.id || ''}
          currentUser={user}
          onClose={() => setShowBulkUpdateModal(false)}
          onSubmitComplete={() => {
            setShowBulkUpdateModal(false);
            refreshBoard();
          }}
        />
      )}
    </div>
  );
};

export default EmployeeAttendanceBoard;
