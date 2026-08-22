import React from 'react';
import MasterPageHeader from '../../../../components/layout/MasterPageHeader';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import CustomSelect from '../../../../components/ui/CustomSelect';
import AttendanceLegend from '../AttendanceLegend';
import RBACManageButton from '../../../../components/ui/RBACManageButton';
import '../../EmployeeAttendanceBoard.css';

const CustomDateInput = React.forwardRef(({ value, onClick, className, placeholder }, ref) => {
  const formattedValue = value ? value.replace(' - ', '  to  ') : '';
  return (
    <input
      value={formattedValue}
      onClick={onClick}
      className={className}
      placeholder={placeholder}
      ref={ref}
      readOnly
    />
  );
});
CustomDateInput.displayName = 'CustomDateInput';

const AttendanceBoardHeader = ({
  // Core Shell Props
  user, permissions, setActiveVertical, onShowBottomNav, isSubSidebarOpen, setIsSubSidebarOpen, SidebarComponent, verticals, activeVertical,
  // View State
  viewMode, setViewMode, isMenuOpen, setIsMenuOpen, setShowMyPlans,
  // Board State
  parsedStart, parsedEnd, handleRangeChange, handleApplyDates,
  page, setPage, hasMore, isBoardLoading, refreshBoard,
  // Planner Hook
  planner, activePlanId, setActivePlanId,
  // Schedule Drafting Hook
  weekString, setWeekString, plannerDateFrom, setEmployeeSelections, totalEntries, isSubmittingPlanner,
  paintbrushStatus, setPaintbrushStatus, paintbrushHubId, setPaintbrushHubId,
  handleSaveDraft, handleSubmitForApproval,
  // Data
  hubs, canApprove, canSuggestEdit
}) => {

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
            customInput={<CustomDateInput />}
          />
          <button 
            className="attendance-board__go-btn" 
            onClick={handleApplyDates}
            aria-label="Apply Dates"
          >
            Apply
          </button>
        </div>
      ) : (
        // Planner Header (Paintbrush & Week)
        <div className="attendance-board__planner-header-group">
          <div className="attendance-board__date-range">
            <DatePicker
              selected={plannerDateFrom ? new Date(plannerDateFrom + 'T00:00:00') : null}
              onChange={(date) => {
                if (!date) return;
                const d = new Date(date);
                const firstThursday = new Date(d.getFullYear(), 0, 4);
                const days = Math.round((d.getTime() - firstThursday.getTime()) / 86400000);
                const weekNumber = 1 + Math.ceil(days / 7);
                setWeekString(`${d.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`);
                setEmployeeSelections({});
                setActivePlanId(null);
                setPage(1);
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
                  { value: 'cursor', label: 'Cursor (Edit Cell)' },
                  { value: 'eraser', label: 'Eraser (Clear Cell)' },
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
          {canApprove && (
            <button
              className="halo-button attendance-board__approval-btn"
              onClick={() => setViewMode('pending-requests')}
            >
              Approvals
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
  );
};

export default AttendanceBoardHeader;
