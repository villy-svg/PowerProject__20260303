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

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MasterPageHeader from '../../components/layout/MasterPageHeader';
import { useAttendanceBoard } from '../../hooks/useAttendanceBoard';
import { useSchedulePlanner } from '../../hooks/useSchedulePlanner';
import AttendanceGrid from './attendance/AttendanceGrid';
import AttendanceMobileList from './attendance/AttendanceMobileList';
import AttendanceLegend from './attendance/AttendanceLegend';
import CustomSelect from '../../components/ui/CustomSelect';
import { IconChevronDown } from '../../components/ui/Icons';
import AttendanceApprovalDrawer from './attendance/AttendanceApprovalDrawer';
import AttendanceSuggestEditModal from './attendance/AttendanceSuggestEditModal';
import SchedulePlanApprovalDrawer from './attendance/SchedulePlanApprovalDrawer';
import ScheduleMyPlansDrawer from './attendance/ScheduleMyPlansDrawer';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './EmployeeAttendanceBoard.css';
import './attendance/AttendanceMobileList.css';
import RBACManageButton from '../../components/ui/RBACManageButton';
import { useLayoutShell } from '../../app/shells/useLayoutShell';
import { supabase } from '../../services/core/supabaseClient';

// --- Week Off Planner Helpers ---
function getWeekStringFromDate(dateInput) {
  const now = new Date(dateInput.valueOf());
  const day = now.getDay() || 7;
  now.setDate(now.getDate() - day + 1);
  const year = now.getFullYear();
  const target = new Date(now.valueOf());
  const dayNr = (now.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

function getCurrentWeekString() {
  return getWeekStringFromDate(new Date());
}

function getDatesFromWeekString(weekStr) {
  if (!weekStr) return { from: '', to: '' };
  const [year, week] = weekStr.split('-W');
  const date = new Date(year, 0, 1);
  const days = (week - 1) * 7;
  const dayOffset = date.getDay() <= 4 && date.getDay() !== 0 ? date.getDay() - 1 : date.getDay() + 6;
  date.setDate(date.getDate() - dayOffset + days);
  
  const fromStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
  const toDate = new Date(date);
  toDate.setDate(toDate.getDate() + 6);
  const toStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(toDate);
  
  return { from: fromStr, to: toStr };
}

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

  // --- PLANNER DRAFT STATE ---
  const [weekString, setWeekString] = useState(getCurrentWeekString());
  const [activePlanId, setActivePlanId] = useState(null);
  const [employeeSelections, setEmployeeSelections] = useState({}); // Record<empId, string[]>
  const [isSubmittingPlanner, setIsSubmittingPlanner] = useState(false);
  const [plannerError, setPlannerError] = useState(null);
  const [plannerSuccess, setPlannerSuccess] = useState(null);

  const [paintbrushStatus, setPaintbrushStatus] = useState('null');
  const [paintbrushHubId, setPaintbrushHubId] = useState('');
  const [hubs, setHubs] = useState([]);
  const [activeCellEdit, setActiveCellEdit] = useState(null);

  useEffect(() => {
    supabase.from('hubs').select('id, name, hub_code').order('name').then(({ data }) => {
      if (data) setHubs(data);
    });
  }, []);

  const { from: plannerDateFrom, to: plannerDateTo } = useMemo(() => getDatesFromWeekString(weekString), [weekString]);
  
  const plannerDateRange = useMemo(() => {
    if (!plannerDateFrom || !plannerDateTo) return [];
    const arr = [];
    const cur = new Date(plannerDateFrom);
    const end = new Date(plannerDateTo);
    while (cur <= end) {
      arr.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  }, [plannerDateFrom, plannerDateTo]);

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

      const selections = employeeSelections[empId] || [];
      const sel = selections.find(d => d.date === date);
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
      const liveData = getLiveCellData(empId, date);
      const isAlreadyMarked = liveData && !liveData.is_scheduled_only && liveData.attendance_status !== 'null';
      if (isAlreadyMarked) {
        return; // do not allow editing already marked attendance
      }

      if (paintbrushStatus === 'null') {
        setActiveCellEdit(prev => (prev?.empId === empId && prev?.date === date) ? null : { empId, date });
        return;
      }
      
      setActiveCellEdit(null);
      setPlannerError(null);
      setPlannerSuccess(null);
      setEmployeeSelections(prev => {
        const current = prev[empId] || [];
        const existingIdx = current.findIndex(d => d.date === date);
        if (existingIdx >= 0) {
          const existing = current[existingIdx];
          if (existing.attendance_status === paintbrushStatus && existing.hub_id === paintbrushHubId) {
            return { ...prev, [empId]: current.filter((_, idx) => idx !== existingIdx) };
          }
          const newArray = [...current];
          newArray[existingIdx] = { date, attendance_status: paintbrushStatus, hub_id: paintbrushHubId };
          return { ...prev, [empId]: newArray };
        } else {
          return { ...prev, [empId]: [...current, { date, attendance_status: paintbrushStatus, hub_id: paintbrushHubId }] };
        }
      });
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
  }, [viewMode, getCellData, canApprove, canSuggestEdit, paintbrushStatus, paintbrushHubId]);

  const handleCellChange = useCallback((empId, date, newStatus, newHubId) => {
    setEmployeeSelections(prev => {
      const current = prev[empId] || [];
      const existingIdx = current.findIndex(d => d.date === date);
      
      if (newStatus === 'null') {
        if (existingIdx >= 0) {
          return { ...prev, [empId]: current.filter((_, idx) => idx !== existingIdx) };
        }
        return prev;
      }

      const newArray = [...current];
      if (existingIdx >= 0) {
        newArray[existingIdx] = { date, attendance_status: newStatus, hub_id: newHubId };
      } else {
        newArray.push({ date, attendance_status: newStatus, hub_id: newHubId });
      }
      return { ...prev, [empId]: newArray };
    });
  }, []);

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

  // --- PLANNER ACTIONS ---
  const totalEntries = useMemo(() => {
    let count = 0;
    Object.values(employeeSelections).forEach(dates => {
      count += dates.length;
    });
    return count;
  }, [employeeSelections]);

  const buildPlannerPayload = useCallback(() => {
    return Object.keys(employeeSelections).map(empId => ({
      employeeId: empId,
      dates: employeeSelections[empId]
    })).filter(sel => sel.dates.length > 0);
  }, [employeeSelections]);

  const handleSaveDraft = useCallback(async () => {
    if (totalEntries === 0) {
      setPlannerError('Please assign at least one date to an employee.');
      return;
    }
    setIsSubmittingPlanner(true);
    setPlannerError(null);
    setPlannerSuccess(null);

    try {
      const { data, error } = await planner.saveDraft({
        planId: activePlanId,
        dateFrom: plannerDateFrom,
        dateTo: plannerDateTo,
        employeeSelections: buildPlannerPayload(),
      });
      if (error) throw error;

      if (!activePlanId && data?.id) setActivePlanId(data.id);
      setPlannerSuccess('Draft saved. You can submit for approval when ready.');
      planner.refreshPlanner();
    } catch (err) {
      setPlannerError(err?.message || 'Failed to save draft. Please try again.');
    } finally {
      setIsSubmittingPlanner(false);
    }
  }, [activePlanId, plannerDateFrom, plannerDateTo, totalEntries, buildPlannerPayload, planner]);

  const handleSubmitForApproval = useCallback(async () => {
    if (totalEntries === 0) {
      setPlannerError('Please assign at least one date to an employee.');
      return;
    }
    setIsSubmittingPlanner(true);
    setPlannerError(null);
    setPlannerSuccess(null);

    try {
      const { data: draftData, error: draftErr } = await planner.saveDraft({
        planId: activePlanId,
        dateFrom: plannerDateFrom,
        dateTo: plannerDateTo,
        employeeSelections: buildPlannerPayload(),
      });
      if (draftErr) throw draftErr;

      const resolvedPlanId = activePlanId || draftData?.id;
      if (!resolvedPlanId) throw new Error('Failed to resolve plan ID after save.');

      const { error: submitErr } = await planner.submitPlan({
        planId: resolvedPlanId,
        dateFrom: plannerDateFrom,
        dateTo: plannerDateTo,
      });
      if (submitErr) throw submitErr;

      setPlannerSuccess(`Plan submitted! ${totalEntries} entries are pending Editor approval.`);
      setActivePlanId(null);
      // Clear selections so they can start fresh
      setEmployeeSelections({});
      planner.refreshPlanner();
    } catch (err) {
      setPlannerError(err?.message || 'Failed to submit plan.');
    } finally {
      setIsSubmittingPlanner(false);
    }
  }, [activePlanId, plannerDateFrom, plannerDateTo, totalEntries, buildPlannerPayload, planner]);

  // Handle loading a rejected plan back into the grid
  const loadPlanIntoGrid = useCallback((plan) => {
    setActivePlanId(plan.id);
    
    // Convert plan.date_from (Monday) back into a week string
    const d = new Date(plan.date_from);
    const year = d.getFullYear();
    const firstThursday = new Date(d.getFullYear(), 0, 4);
    const days = Math.round((d.getTime() - firstThursday.getTime()) / 86400000);
    const weekNumber = 1 + Math.ceil(days / 7);
    setWeekString(`${year}-W${weekNumber.toString().padStart(2, '0')}`);

    const newSelections = {};
    const entries = plan.employee_schedule_plan_entries || [];
    entries.forEach(entry => {
      if (!newSelections[entry.employee_id]) {
        newSelections[entry.employee_id] = [];
      }
      newSelections[entry.employee_id].push({
        date: entry.shift_date,
        attendance_status: entry.attendance_status,
        hub_id: entry.hub_id
      });
    });
    setEmployeeSelections(newSelections);
    setViewMode('planner');
    setPlannerError(null);
    setPlannerSuccess(null);
    setShowMyPlans(false);
  }, []);

  // Guard: RBAC access check
  if (!permissions?.canAccessEmployeeAttendanceBoard) {
    return (
      <div className="attendance-board__no-access">
        <p>You do not have access to the Attendance Board.</p>
      </div>
    );
  }

  // --- HEADER ACTIONS ---
  const headerLeftActions = (
    <div className="attendance-board__left-actions">
      {viewMode === 'pending-requests' || viewMode === 'pending-plans' ? (
        <button 
          className="halo-button u-flex-center-gap-8" 
          onClick={() => setViewMode('attendance')}
        >
          <span>←</span> Back to Board
        </button>
      ) : viewMode === 'attendance' ? (
        // Standard Attendance Date Pickers
        <div className="attendance-board__date-range">
          <label className="attendance-board__date-label">Date Range</label>
          <DatePicker
            selectsRange={true}
            startDate={parsedStart}
            endDate={parsedEnd}
            onChange={handleRangeChange}
            monthsShown={2}
            calendarStartDay={1}
            dateFormat="dd-MM-yyyy"
            className="attendance-board__date-input attendance-board__date-input--range"
            wrapperClassName="attendance-board__date-wrapper"
            portalId="root"
            placeholderText="Select Date Range"
          />
          <button 
            className="attendance-board__go-btn" 
            onClick={handleApplyDates}
            aria-label="Apply Dates"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
      ) : (
        // Planner Week Picker & Paintbrush
        <div className="u-flex-gap-16 u-items-center">
          <div className="attendance-board__date-range">
            <label className="attendance-board__date-label">Target Week</label>
            <DatePicker
              selected={plannerDateFrom ? new Date(plannerDateFrom + 'T00:00:00') : null}
              onChange={(date) => {
                if (date) setWeekString(getWeekStringFromDate(date));
              }}
              showWeekPicker
              showWeekNumbers
              calendarStartDay={1}
              dateFormat="I-R"
              className="attendance-board__week-input"
              wrapperClassName="attendance-board__date-wrapper"
              portalId="root"
            />
          </div>
          {canSuggestEdit && (
            <div className="u-flex-gap-8 u-items-center">
              <label className="u-text-sm u-fw-600 u-text-secondary">Paintbrush:</label>
              <CustomSelect
                value={paintbrushStatus}
                onChange={setPaintbrushStatus}
                className="u-w-180 u-py-4 u-pl-8 u-text-sm-85"
                options={[
                  { value: 'null', label: 'NULL (Not Marked)' },
                  { value: 'present', label: 'Present (Day)' },
                  { value: 'present-night', label: 'Present (Night)' },
                  { value: 'week-off', label: 'Week-Off' },
                  { value: 'leave', label: 'Leave' },
                  { value: 'absent', label: 'Absent' },
                  { value: 'no-show', label: 'No Show' },
                  { value: 'no-call-no-show', label: 'No Call No Show' }
                ]}
              />
              {(paintbrushStatus === 'present' || paintbrushStatus === 'present-night') && (
                <CustomSelect
                  value={paintbrushHubId}
                  onChange={setPaintbrushHubId}
                  className="u-w-130 u-py-4 u-pl-8 u-text-sm-85"
                  options={[
                    { value: '', label: 'No Hub' },
                    ...hubs.map(h => ({ value: h.id, label: h.hub_code || h.name }))
                  ]}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const headerRightActions = (
    <>
      {viewMode === 'pending-requests' || viewMode === 'pending-plans' ? null : viewMode === 'planner' ? (
        <>
          <button
            className="halo-button attendance-board__planner-action--save"
            onClick={handleSaveDraft}
            disabled={isSubmittingPlanner || totalEntries === 0}
          >
            {isSubmittingPlanner ? 'Saving…' : '💾 Save Draft'}
          </button>
          <button
            className="halo-button attendance-board__planner-action--submit"
            onClick={handleSubmitForApproval}
            disabled={isSubmittingPlanner || totalEntries === 0}
          >
            {isSubmittingPlanner ? 'Submitting…' : '→ Submit Plan'}
          </button>
        </>
      ) : (
        <>
          {/* Pending Plans badge — editor */}
          {canApprove && !!planner.pendingPlansCount && (
            <button
              className="halo-button attendance-board__approval-btn"
              onClick={() => setViewMode('pending-plans')}
              title="Editors can approve or reject bulk week-off plans."
            >
              <span className="attendance-board__pending-badge">
                {planner.pendingPlansCount}
              </span>
              Pending Plans
            </button>
          )}

          {/* Individual edit request approval queue badge — editors only */}
          {canApprove && !!pendingRequests.length && (
            <button
              className="halo-button attendance-board__approval-btn"
              onClick={() => setViewMode('pending-requests')}
            >
              Pending Approvals
            </button>
          )}

          <button
            className="halo-button master-action-btn"
            onClick={refreshBoard}
            disabled={isBoardLoading}
          >
            {isBoardLoading ? 'Loading…' : 'Refresh'}
          </button>
        </>
      )}

      {/* MENU handled by expandedLeft in MasterPageHeader */}


      <RBACManageButton 
        user={user} 
        verticalId="employees" 
        featureId="canAccessEmployeeAttendanceBoard" 
        label="Attendance Board" 
      />
    </>
  );

  const headerExpandedLeft = (viewMode === 'pending-requests' || viewMode === 'pending-plans') ? null : (
    <div className="u-flex-wrap-gap-24 u-items-center u-w-full">
      {canSuggestEdit && (
        <div className="view-mode-toggle">
          <button
            className={`view-toggle-btn ${viewMode === 'attendance' ? 'active' : ''}`}
            onClick={() => { setViewMode('attendance'); setIsMenuOpen(false); }}
          >
            Attendance Board
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'planner' ? 'active' : ''}`}
            onClick={() => { setViewMode('planner'); setIsMenuOpen(false); }}
          >
            Schedule Planner
          </button>
        </div>
      )}

      {/* Date Filter & Pagination */}
      <div className="u-flex-gap-16 u-items-center">
        {viewMode === 'attendance' ? (
          <>
            <div className="u-flex-gap-8 u-items-center u-ml-12">
              <button 
                className="halo-button btn-xs u-min-h-auto" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ◀ Prev
              </button>
              <span className="u-text-xs u-fw-800 u-text-secondary">
                PAGE {page}
              </span>
              <button 
                className="halo-button btn-xs u-min-h-auto" 
                onClick={() => setPage(p => p + 1)}
                disabled={!hasMore}
              >
                Next ▶
              </button>
            </div>
          </>
        ) : (
          <div className="attendance-board__date-range">
            <span className="attendance-board__date-label">Week:</span>
            <input 
              type="week" 
              value={weekString} 
              onChange={e => {
                setWeekString(e.target.value);
                // Also reset grid selections when week changes so they don't get misaligned
                setEmployeeSelections({});
                setActivePlanId(null);
                setPage(1);
              }}
              className="attendance-board__week-input"
            />
          </div>
        )}
      </div>

      <div className="u-flex u-w-full u-items-center">
        <AttendanceLegend />
      </div>

      {canSuggestEdit && planner.myPlans.length > 0 && (
        <button 
          className="halo-button master-action-btn u-flex-center-gap-8"
          onClick={() => {
            setShowMyPlans(true);
            setIsMenuOpen(false);
          }}
        >
          My Plans History
          <span className="attendance-board__pending-badge u-m-0">
            {planner.myPlans.length}
          </span>
        </button>
      )}
    </div>
  );

  return (
    <div className="attendance-board__wrapper">
      <MasterPageHeader
        title={
          viewMode === 'planner' ? "Schedule Planner" : 
          viewMode === 'pending-requests' ? "Pending Edit Requests" : 
          viewMode === 'pending-plans' ? "Pending Schedule Plans" : 
          "Attendance Board"
        }
        description={
          viewMode === 'planner' ? (
            <span>Select a status and hub for your paintbrush, then click cells to paint shifts for this week.</span>
          ) : viewMode === 'pending-requests' || viewMode === 'pending-plans' ? (
            <span>Review and approve pending requests from your team.</span>
          ) : (
            <span>
              Daily log for employee shifts, check-ins, and leave tracking.
              <span className="attendance-board__info-icon" title="Switch to the Schedule Planner via the Menu to submit bulk requests.">ⓘ</span>
            </span>
          )
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
        expandedLeft={headerExpandedLeft}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
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

