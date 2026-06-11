import React from 'react';
import MasterPageHeader from '../../components/MasterPageHeader';
import './EmployeeAttendanceBoard.css';

const EmployeeAttendanceBoard = ({
  user,
  permissions,
  setActiveVertical,
  onShowBottomNav,
  isSubSidebarOpen,
  setIsSubSidebarOpen,
  SidebarComponent,
  onFilterChange,
  onReset,
  onBatchFilter,
  filters,
  verticals,
  activeVertical,
}) => {
  return (
    <>
      <MasterPageHeader
        title="Attendance Board"
        description="Daily log for employee shifts, check-ins, and leave tracking."
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        isSubSidebarOpen={isSubSidebarOpen}
        onSidebarToggle={setIsSubSidebarOpen}
        hideMenuClose={true}
        SidebarComponent={SidebarComponent}
        onFilterChange={onFilterChange}
        onReset={onReset}
        onBatchFilter={onBatchFilter}
        filters={filters}
        user={user}
        permissions={permissions}
        verticals={verticals}
        activeVertical={activeVertical}
      <div className="empty-state-container">
        <div className="empty-state-icon">📅</div>
        <h3 className="empty-state-title">Attendance Data Empty</h3>
        <p className="empty-state-text">
          The Attendance Board is currently in setup mode. 
          Check back later for complete attendance tracking functionality.
        </p>
      </div>
    </>
  );
};

export default EmployeeAttendanceBoard;
