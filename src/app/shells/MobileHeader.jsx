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
} from '../../components/Icons';
import MasterHeaderMenu from '../../components/MasterHeaderMenu';

const MobileHeader = ({
  title,
  leftActions,
  rightActions,
  expandedLeft,
  expandedRight,
  isMenuOpen,
  setIsMenuOpen,
  isScrollVisible,
  isSubSidebarOpen,
  onSidebarToggle,
  canAdd,
  onAddClick,
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
}) => {
  const hasExpandedContent = !!(expandedLeft || expandedRight || SidebarComponent);
  const [isBoardSubTrayOpen, setIsBoardSubTrayOpen] = useState(false);

  // ─── Body scroll lock for mobile menu ─────────────────────────────
  useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
    return () => document.body.classList.remove('no-scroll');
  }, [isMenuOpen]);

  // ─── Compute available boards for active vertical ─────────────────
  const getBoardsForActiveVertical = () => {
    const hubId = verticals?.CHARGING_HUBS?.id || 'CHARGING_HUBS';
    const empId = verticals?.EMPLOYEES?.id || 'EMPLOYEES';
    const clientId = verticals?.CLIENTS?.id || 'CLIENTS';

    const isHub = activeVertical === hubId || ['hub_tasks', 'daily_hub_tasks', 'daily_task_templates', 'escalation_tasks'].includes(activeVertical);
    const isEmp = activeVertical === empId || ['employee_tasks'].includes(activeVertical);
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
        list.push({ id: 'employee_tasks', label: 'Employee Tasks' });
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
  const isHeaderHidden = !isScrollVisible && !isMenuOpen && !isSubSidebarOpen && !isSidebarOpen && !isBoardSubTrayOpen;

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
      {isBoardSubTrayOpen && (
        <div 
          className="sub-tray-backdrop" 
          onClick={() => setIsBoardSubTrayOpen(false)} 
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

      {/* MOBILE ACTION TRAY (bottom pill bar) */}
      <div className={`mobile-action-tray ${(isScrollVisible || isMenuOpen || isSubSidebarOpen || isSidebarOpen || isBoardSubTrayOpen) ? '' : 'tray-hidden'}`}>
        <div className="mobile-action-tray-container">
          {/* Home / Switch Vertical */}
          <button
            className="halo-button mobile-tray-btn"
            title="Switch Vertical"
            onClick={() => { 
              if (onShowBottomNav) onShowBottomNav(); 
              setIsBoardSubTrayOpen(false);
              setIsMenuOpen(false);
            }}
          >
            <IconHome size={22} />
          </button>

          {/* Board Switcher Toggle (Icon 1) */}
          {boards.length > 0 && (
            <button
              className={`halo-button mobile-tray-btn ${isBoardSubTrayOpen ? 'active' : ''}`}
              onClick={() => {
                const nextState = !isBoardSubTrayOpen;
                setIsBoardSubTrayOpen(nextState);
                if (nextState) setIsMenuOpen(false);
              }}
              title="Select Board"
            >
              <IconBoards size={20} />
            </button>
          )}

          {/* Filters Overlay Toggle (Icon 2 - Funnel replacing legacy Menu Toggle) */}
          {hasExpandedContent && (
            <button
              className={`halo-button mobile-tray-btn ${isMenuOpen ? 'active' : ''}`}
              onClick={() => {
                const nextMenuState = !isMenuOpen;
                setIsMenuOpen(nextMenuState);
                setIsBoardSubTrayOpen(false);
                if (nextMenuState && onSidebarToggle) onSidebarToggle(false);
              }}
              title="Toggle Filters"
            >
              <IconFilter size={20} />
            </button>
          )}

          {/* Add Button */}
          {canAdd && (
            <button
              className={`halo-button mobile-tray-btn mobile-add-btn ${isTaskModalOpen ? 'active' : ''}`}
              onClick={() => {
                onAddClick();
                setIsBoardSubTrayOpen(false);
                setIsMenuOpen(false);
              }}
              title="Add New"
            >
              <IconPlus size={24} />
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default MobileHeader;
