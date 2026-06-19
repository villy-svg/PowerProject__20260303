/**
 * MobileHeader.jsx
 *
 * Mobile-only header component. Features:
 * - Sticky scroll-aware show/hide (Chrome-style)
 * - Mobile Action Tray (bottom pill bar with Home, Board Switcher, Filters/Menu, Add)
 * - Body scroll lock when menu is open
 * - Full-screen overlay menu (slides down from top)
 * - Custom Board Switcher Sub-Tray directly above the tray
 * - Unified Filters overlay rendering the vertical's column checkboxes
 *
 * DOES NOT INCLUDE:
 * - Inline menu row (that's desktop-only)
 * - Description text (hidden on mobile for space)
 *
 * Skill compliance:
 * - adaptive-ui-strategy §4 Mobile Interactions (Touch)
 * - adaptive-ui-strategy §5 Mobile Layout
 * - master-header-system §1-5
 */

import React, { useEffect, useState } from 'react';
import {
  IconHome,
  IconPlus,
  IconBoards,
  IconFilter,
} from '../../components/ui/Icons';
import MasterHeaderMenu from '../../components/layout/MasterHeaderMenu';
import SearchBar from '../../components/ui/SearchBar';
import '../../components/layout/BottomNav.css';
import { useAppNavigation } from '../contexts/AppNavigationContext';

const MobileHeader = ({
  title,
  leftActions,
  rightActions,
  expandedLeft,
  expandedRight,
  isScrollVisible,
  isSubSidebarOpen,
  onSidebarToggle,
  canAdd,
  onAddClick,
  addLabel,
  isTaskModalOpen,
  onShowBottomNav,
  hideMenuClose,
  isSidebarOpen,
  // New props forwarded from MasterPageHeader
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
  // Optional records-mode props
  searchRecords,
  recordType,
  onSearchSelect,
}) => {
  const hasExpandedContent = !!(expandedLeft || expandedRight || SidebarComponent);
  // isBoardSubTrayOpen and isMenuOpen lifted to AppNavigationContext so the
  // hardware back button can dismiss them. They remain functionally identical.
  const {
    isMobileMenuOpen: isMenuOpen,
    setIsMobileMenuOpen: setIsMenuOpen,
    isMobileBoardSubTrayOpen: isBoardSubTrayOpen,
    setIsMobileBoardSubTrayOpen: setIsBoardSubTrayOpen,
    isMobileAddTrayOpen,
    setIsMobileAddTrayOpen,
    showBottomNavOverlay,
  } = useAppNavigation();

  // No-op body scroll lock: Mobile menu is now inline and scrolls naturally with the page.

  // ─── Compute available boards for active vertical ─────────────────
  const getBoardsForActiveVertical = () => {
    const hubId = verticals?.CHARGING_HUBS?.id || 'CHARGING_HUBS';
    const empId = verticals?.EMPLOYEES?.id || 'EMPLOYEES';
    const clientId = verticals?.CLIENTS?.id || 'CLIENTS';

    const isHub = activeVertical === hubId || ['hub_tasks', 'daily_hub_tasks', 'daily_task_templates', 'escalation_tasks'].includes(activeVertical);
    const isEmp = activeVertical === empId || ['employee_tasks', 'employee_rules_board', 'employee_attendance_board', 'attendance_self_service'].includes(activeVertical);
    const isClient = activeVertical === clientId || ['client_tasks', 'leads_funnel'].includes(activeVertical);

    const list = [];
    if (isHub) {
      if (permissions?.canAccessHubTasks !== false) {
        list.push({ id: 'hub_tasks', label: 'Hubs Task Board' });
      }
      if (permissions?.canAccessDailyHubTasks !== false) {
        list.push({ id: 'daily_hub_tasks', label: 'Daily Task Board' });
      }
      if (permissions?.canAccessEscalationTasks !== false) {
        list.push({ id: 'escalation_tasks', label: 'Escalation Task Board' });
      }
      if (permissions?.canAccessDailyTaskTemplates !== false) {
        list.push({ id: 'daily_task_templates', label: 'Daily Task Templates' });
      }
    } else if (isEmp) {
      if (permissions?.canAccessEmployeeTasks !== false) {
        list.push({ id: 'employee_tasks', label: 'Remarks Manager' });
      }
      if (permissions?.canAccessEmployeeRulesBoard !== false) {
        list.push({ id: 'employee_rules_board', label: 'Rules & Regulations' });
      }
      if (permissions?.canAccessEmployeeAttendanceBoard !== false) {
        list.push({ id: 'employee_attendance_board', label: 'Attendance Board' });
      }
      if (permissions?.canAccessAttendanceSelfService !== false) {
        list.push({ id: 'attendance_self_service', label: 'Current Attendance' });
      }
      if (permissions?.canAccessEmployees !== false) {
        list.push({ id: empId, label: 'Employees List' });
      }
    } else if (isClient) {
      if (permissions?.canAccessClientTasks !== false) {
        list.push({ id: 'client_tasks', label: 'Client Tasks' });
      }
      if (permissions?.canAccessLeadsFunnel !== false) {
        list.push({ id: 'leads_funnel', label: 'Leads Funnel' });
      }
      if (permissions?.canAccessClients !== false) {
        list.push({ id: clientId, label: 'Clients List' });
      }
    }
    return list;
  };

  const boards = getBoardsForActiveVertical();

  // ─── Compute header visibility ────────────────────────────────────
  const isHeaderHidden = !isScrollVisible && !isMenuOpen && !isSubSidebarOpen && !isSidebarOpen && !isBoardSubTrayOpen && !isMobileAddTrayOpen;

  return (
    <>
      <header className={`master-page-header mobile-header-shell ${isMenuOpen ? 'is-sticky' : ''} ${isHeaderHidden ? 'header-hidden' : ''}`}>
        {/* Row 1: Title (compact on mobile) */}
        <div className="header-row-1">
          <h1>{title}</h1>
        </div>

        {/* Row 2: Description — HIDDEN on mobile (adaptive-ui-strategy §6) */}
      </header>

      {/* Expanded Menu Overlay (slides down from top on mobile) */}
      {/* RENDERED OUTSIDE header to prevent sticky container/compositing and transform bugs on mobile */}
      {hasExpandedContent && isMenuOpen && (
        <MasterHeaderMenu
          expandedLeft={expandedLeft}
          expandedRight={expandedRight}
          onClose={() => setIsMenuOpen(false)}
          hideCloseButton={hideMenuClose}
          isVisible={isMenuOpen}
          SidebarComponent={SidebarComponent}
          onFilterChange={onFilterChange}
          onReset={onReset}
          onBatchFilter={onBatchFilter}
          filters={filters}
          tasks={tasks}
          permissions={permissions}
          user={user}
          activeVertical={activeVertical}
          setActiveVertical={setActiveVertical}
        />
      )}

      {/* SUB-TRAY BACKDROP MASK */}
      {(isBoardSubTrayOpen || isMobileAddTrayOpen) && (
        <div 
          className="sub-tray-backdrop" 
          onClick={() => {
            setIsBoardSubTrayOpen(false);
            setIsMobileAddTrayOpen(false);
          }} 
        />
      )}

      {/* BOARD SWITCHER FLOATING SUB-TRAY SHEET */}
      {isBoardSubTrayOpen && boards.length > 0 && (
        <div className={`mobile-board-sub-tray ${isHeaderHidden ? 'tray-hidden' : ''}`}>
          <div className="mobile-board-sub-tray-header">
            <h4>Select Task Board</h4>
            <button 
              className="sub-tray-close-btn"
              onClick={() => setIsBoardSubTrayOpen(false)}
              title="Close Board Switcher"
            >
              ✕
            </button>
          </div>
          <div className="mobile-board-sub-tray-content custom-scrollbar">
            {boards.map(board => {
              const isActive = activeVertical === board.id;
              return (
                <button
                  key={board.id}
                  className={`sub-tray-option-btn ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setActiveVertical(board.id);
                    setIsBoardSubTrayOpen(false);
                  }}
                >
                  <span className="option-label">{board.label}</span>
                  {isActive && <span className="active-dot" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* QUICK ACTIONS FLOATING SUB-TRAY SHEET */}
      {isMobileAddTrayOpen && (
        <div className={`mobile-board-sub-tray mobile-add-sub-tray ${isHeaderHidden ? 'tray-hidden' : ''}`}>
          <div className="mobile-board-sub-tray-header">
            <h4>Quick Actions</h4>
            <button 
              className="sub-tray-close-btn"
              onClick={() => setIsMobileAddTrayOpen(false)}
              title="Close Quick Actions"
            >
              ✕
            </button>
          </div>
          <div className="mobile-board-sub-tray-content custom-scrollbar">
            {/* Create New Task Action Button */}
            <button
              className="sub-tray-option-btn primary-action-btn"
              onClick={() => {
                onAddClick();
                setIsMobileAddTrayOpen(false);
              }}
            >
              <span className="option-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
                <IconPlus size={16} />
                {addLabel || 'Create New Task'}
              </span>
            </button>

            {/* Contextual Data Operations */}
            {expandedRight && (
              <div className="mobile-sub-tray-expanded-actions">
                <div className="sub-tray-section-title">Data Operations</div>
                <div className="expanded-actions-list">
                  {expandedRight}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MOBILE ACTION TRAY (bottom pill bar) */}
      <div className={`mobile-action-tray ${(isScrollVisible || isMenuOpen || isSubSidebarOpen || isSidebarOpen || isBoardSubTrayOpen || isMobileAddTrayOpen) ? '' : 'tray-hidden'}`}>
        <div className="bottom-nav-container mobile-action-tray-container">
          {/* Home / Switch Vertical */}
          <button
            className={`nav-item mobile-tray-btn ${showBottomNavOverlay ? 'active' : ''}`}
            title="Switch Vertical"
            onClick={() => { 
              if (onShowBottomNav) onShowBottomNav(); 
              setIsBoardSubTrayOpen(false);
              setIsMobileAddTrayOpen(false);
              setIsMenuOpen(false);
            }}
          >
            <div className="icon-wrapper">
              <IconHome size={16} strokeWidth={showBottomNavOverlay ? 2.2 : 1.8} />
            </div>
            <span className="nav-label">Switch</span>
          </button>

          {/* Board Switcher Toggle (Icon 1) */}
          {boards.length > 0 && (
            <button
              className={`nav-item mobile-tray-btn ${isBoardSubTrayOpen ? 'active' : ''}`}
              onClick={() => {
                const nextState = !isBoardSubTrayOpen;
                setIsBoardSubTrayOpen(nextState);
                setIsMobileAddTrayOpen(false);
                if (nextState) setIsMenuOpen(false);
              }}
              title="Select Board"
            >
              <div className="icon-wrapper">
                <IconBoards size={16} strokeWidth={isBoardSubTrayOpen ? 2.2 : 1.8} />
              </div>
              <span className="nav-label">Boards</span>
            </button>
          )}

          {/* Filters Overlay Toggle (Icon 2 - Funnel replacing legacy Menu Toggle) */}
          {hasExpandedContent && (
            <button
              className={`nav-item mobile-tray-btn ${isMenuOpen ? 'active' : ''}`}
              onClick={() => {
                const nextMenuState = !isMenuOpen;
                setIsMenuOpen(nextMenuState);
                setIsBoardSubTrayOpen(false);
                setIsMobileAddTrayOpen(false);
                if (nextMenuState && onSidebarToggle) onSidebarToggle(false);
              }}
              title="Toggle Filters"
            >
              <div className="icon-wrapper">
                <IconFilter size={16} strokeWidth={isMenuOpen ? 2.2 : 1.8} />
              </div>
              <span className="nav-label">Filters</span>
            </button>
          )}

          {/* Add Button */}
          {canAdd && (
            <button
              className={`nav-item mobile-tray-btn mobile-add-btn ${(isTaskModalOpen || isMobileAddTrayOpen) ? 'active' : ''}`}
              onClick={() => {
                const nextAddTrayState = !isMobileAddTrayOpen;
                setIsMobileAddTrayOpen(nextAddTrayState);
                setIsBoardSubTrayOpen(false);
                setIsMenuOpen(false);
              }}
              title="Add / Actions"
            >
              <div className="icon-wrapper">
                <IconPlus size={16} strokeWidth={(isTaskModalOpen || isMobileAddTrayOpen) ? 2.2 : 1.8} />
              </div>
              <span className="nav-label">Add</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default MobileHeader;
