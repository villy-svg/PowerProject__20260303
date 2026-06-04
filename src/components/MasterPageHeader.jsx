import React from 'react';
import { useLayoutShell } from '../app/shells/useLayoutShell';
import DesktopHeader from '../app/shells/DesktopHeader';
import MobileHeader from '../app/shells/MobileHeader';
import { useHeaderState } from '../app/shells/useHeaderState';
import './MasterPageHeader.css';

/**
 * MasterPageHeader
 * 
 * Standardized 3-row (+ expanded Menu) layout for all vertical management pages.
 * 
 * Props:
 *   title          {string}    - Row 1: Main page title
 *   description    {string}    - Row 2: Short description/info
 *   leftActions    {node}      - Row 3 Left: Contextual tools (now usually the Menu button)
 *   rightActions   {node}      - Row 3 Right: Primary action buttons (e.g. + Add Task)
 *   expandedLeft   {node}      - Row 4 Left: Menu Row content (View toggles, filters)
 *   expandedRight  {node}      - Row 4 Right: Menu Row content (Import/Export/Bulk)
 */
const MasterPageHeader = ({ 
  title, 
  description, 
  leftActions, 
  rightActions, 
  expandedLeft, 
  expandedRight,
  isSubSidebarOpen,
  onSidebarToggle,
  canAdd,
  onAddClick,
  addLabel,
  isTaskModalOpen,
  onShowBottomNav,
  onTrayVisibilityChange,
  isMenuOpen: controlledIsMenuOpen,
  setIsMenuOpen: controlledSetIsMenuOpen,
  hideMenuClose,
  isSidebarOpen,
  SidebarComponent,
  onFilterChange,
  onReset,
  onBatchFilter,
  filters,
  tasks,
  setActiveVertical,
  activeVertical,
  permissions,
  user,
  verticals,
  // Optional records-mode search props
  searchRecords,
  recordType,
  onSearchSelect,
}) => {
  const { shellType } = useLayoutShell();
  
  const headerState = useHeaderState({
    isSubSidebarOpen,
    onSidebarToggle,
    isTaskModalOpen,
    isSidebarOpen,
    controlledIsMenuOpen,
    controlledSetIsMenuOpen,
  });

  // Sync tray visibility upstream (for BulkActionBar, etc.)
  React.useEffect(() => {
    if (onTrayVisibilityChange) onTrayVisibilityChange(headerState.isTrayVisible);
  }, [headerState.isTrayVisible, onTrayVisibilityChange]);

  if (shellType === 'desktop') {
    return (
      <DesktopHeader
        title={title}
        description={description}
        leftActions={leftActions}
        rightActions={rightActions}
        expandedLeft={expandedLeft}
        expandedRight={expandedRight}
        isMenuOpen={headerState.isMenuOpen}
        setIsMenuOpen={headerState.setIsMenuOpen}
        hideMenuClose={hideMenuClose}
        searchRecords={searchRecords}
        recordType={recordType}
        onSearchSelect={onSearchSelect}
      />
    );
  }

  return (
    <MobileHeader
      title={title}
      leftActions={leftActions}
      rightActions={rightActions}
      expandedLeft={expandedLeft}
      expandedRight={expandedRight}
      isMenuOpen={headerState.isMenuOpen}
      setIsMenuOpen={headerState.setIsMenuOpen}
      isScrollVisible={headerState.isScrollVisible}
      isSubSidebarOpen={isSubSidebarOpen}
      onSidebarToggle={onSidebarToggle}
      canAdd={canAdd}
      onAddClick={onAddClick}
      addLabel={addLabel}
      isTaskModalOpen={isTaskModalOpen}
      onShowBottomNav={onShowBottomNav}
      hideMenuClose={hideMenuClose}
      isSidebarOpen={isSidebarOpen}
      SidebarComponent={SidebarComponent}
      onFilterChange={onFilterChange}
      onReset={onReset}
      onBatchFilter={onBatchFilter}
      filters={filters}
      tasks={tasks}
      setActiveVertical={setActiveVertical}
      activeVertical={activeVertical}
      permissions={permissions}
      user={user}
      verticals={verticals}
      searchRecords={searchRecords}
      recordType={recordType}
      onSearchSelect={onSearchSelect}
    />
  );
};

export default MasterPageHeader;

