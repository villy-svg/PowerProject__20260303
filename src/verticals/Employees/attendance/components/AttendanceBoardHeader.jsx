import React from 'react';
import MasterPageHeader from '../../../../components/layout/MasterPageHeader';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import AttendanceLegend from '../AttendanceLegend';
import CustomSelect from '../../../../components/ui/CustomSelect';
import RBACManageButton from '../../../../components/ui/RBACManageButton';
import { IconRefresh } from '../../../../components/ui/Icons';

// TODO(future-rebuild): Complex bulk Schedule Planner header controls (Week Picker,
// Paintbrush Status/Hub selectors, Save Draft / Submit Plan, Pending Plans button,
// and My Plans History button) were stripped per Section A.2/A.4/A.5.
// Replaced with a single "Multi-Day Update" button (1 employee, multiple days).
// External wiring (useSchedulePlanner + schedulePlannerService) remains intact.

const CustomDateInput = React.forwardRef(({ value, onClick, className, placeholder }, ref) => {
  // Single-spaced separator keeps the range pill compact on 11"/13" laptops
  const formattedValue = value ? value.replace(' - ', ' to ') : '';
  return (
    <input
      value={formattedValue}
      onClick={onClick}
      className={className}
      placeholder={placeholder}
      aria-label="Attendance date range"
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
  viewMode, setViewMode, isMenuOpen, setIsMenuOpen, onOpenBulkUpdate,
  // Board State
  parsedStart, parsedEnd, handleRangeChange, handleApplyDates, onApplyPreset,
  page, setPage, hasMore, isBoardLoading, refreshBoard,
  pendingRequestsCount = 0,
  // Desktop-only Hub Filter (C.1) & Shell Type (B.3)
  hubOptions = [], selectedHubId = '', onHubChange, shellType = 'desktop',
  // Permissions
  canApprove, canSuggestEdit,
  // Employee Search (records-mode SearchBar)
  searchRecords, recordType, onSearchSelect
}) => {
  const headerLeftActions = (
    <div className="attendance-board__left-actions">
      {viewMode === 'pending-requests' ? (
        <button
          type="button"
          className="halo-button u-flex-center-gap-8"
          onClick={() => setViewMode('attendance')}
        >
          <span>←</span> Back to Board
        </button>
      ) : (
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
            type="button"
            className="attendance-board__go-btn"
            onClick={handleApplyDates}
            aria-label="Apply Dates"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );

  const headerRightActions = (
    <>
      {viewMode === 'pending-requests' ? null : (
        <>
          {/* Simplified A.2: Single-employee, multi-day updater (compact label for laptop viewports) */}
          {canSuggestEdit && (
            <button
              type="button"
              className="halo-button master-action-btn"
              onClick={onOpenBulkUpdate}
              title="Update multiple dates for one employee at once."
            >
              + Multi
            </button>
          )}

          {/* Individual edit request approval queue — editors only (with live pending badge) */}
          {canApprove && (
            <button
              type="button"
              className="halo-button attendance-board__approval-btn"
              onClick={() => setViewMode('pending-requests')}
            >
              {pendingRequestsCount > 0 && (
                <span className="attendance-board__pending-badge">
                  {pendingRequestsCount}
                </span>
              )}
              Approvals
            </button>
          )}

          {/* Icon-only Refresh to save horizontal space on 11"/13" laptop headers */}
          <button
            type="button"
            className={`halo-button attendance-board__refresh-btn${isBoardLoading ? ' attendance-board__refresh-btn--loading' : ''}`}
            onClick={refreshBoard}
            disabled={isBoardLoading}
            title={isBoardLoading ? 'Refreshing attendance…' : 'Refresh attendance'}
            aria-label="Refresh attendance"
          >
            <IconRefresh size={15} />
          </button>
        </>
      )}
      <RBACManageButton
        user={user}
        verticalId="EMPLOYEES"
        featureId="canAccessEmployeeAttendanceBoard"
        label="Attendance Board"
      />
    </>
  );

  /* Scoped BEM layout for Row 4 expanded menu (Desktop only — Mobile omits pagination, hub filter & legend per B.3/C.1/C.2) */
  const headerExpandedLeft = (viewMode === 'pending-requests' || shellType === 'mobile') ? null : (
    <div className="attendance-board__menu-content">
      <div className="attendance-board__menu-controls">
        {/* Desktop-only Hub Filter (C.1) */}
        {hubOptions.length > 1 && onHubChange && (
          <div className="attendance-board__hub-filter">
            <CustomSelect
              value={selectedHubId}
              onChange={onHubChange}
              className="attendance-board__hub-select"
              options={hubOptions}
            />
          </div>
        )}

        {/* Desktop Quick Date Presets (C.3 parity with Phone) */}
        {onApplyPreset && (
          <div className="attendance-board__desktop-presets" role="group" aria-label="Quick date presets">
            <button type="button" className="halo-button" onClick={() => { onApplyPreset('this-week'); setIsMenuOpen(false); }}>
              This Week
            </button>
            <button type="button" className="halo-button" onClick={() => { onApplyPreset('last-14'); setIsMenuOpen(false); }}>
              Last 14 Days
            </button>
            <button type="button" className="halo-button" onClick={() => { onApplyPreset('this-month'); setIsMenuOpen(false); }}>
              Current Month
            </button>
            <button type="button" className="halo-button" onClick={() => { onApplyPreset('last-month'); setIsMenuOpen(false); }}>
              Last Month
            </button>
          </div>
        )}

        <div className="attendance-board__pagination">
          <button
            type="button"
            className="halo-button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ◀ Prev
          </button>
          <span className="attendance-board__page-label">
            PAGE {page}
          </span>
          <button
            type="button"
            className="halo-button"
            onClick={() => setPage(p => p + 1)}
            disabled={!hasMore}
          >
            Next ▶
          </button>
        </div>
      </div>

      <div className="attendance-board__menu-legend">
        <AttendanceLegend />
      </div>
    </div>
  );

  return (
    <MasterPageHeader
      title={
        viewMode === 'pending-requests'
          ? 'Pending Edit Requests'
          : 'Attendance Board'
      }
      description={
        viewMode === 'pending-requests' ? (
          <span>Review and approve pending attendance edit requests from your team.</span>
        ) : (
          <span>
            Daily log for employee shifts, check-ins, and leave tracking.
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
      searchRecords={searchRecords}
      recordType={recordType}
      onSearchSelect={onSearchSelect}
      hideSearchBar={viewMode === 'pending-requests'}
    />
  );
};

export default AttendanceBoardHeader;
