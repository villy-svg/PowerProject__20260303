/**
 * useHeaderState.js
 *
 * Shared state for both Desktop and Mobile header implementations.
 * Owns: menu open/close, tray visibility sync, mutual exclusivity logic.
 *
 * IMPORTANT: This hook does NOT determine which header to render.
 * That decision lives in useLayoutShell / LayoutShell.
 *
 * Skill compliance:
 * - development-best-practices §2 State Management
 * - master-header-system §1 Component Structure
 */

import { useState, useEffect, useCallback } from 'react';
import { useScrollDirection } from '../../hooks/useScrollDirection';

export function useHeaderState({
  isSubSidebarOpen = false,
  onSidebarToggle,
  isTaskModalOpen = false,
  isSidebarOpen = false,
  controlledIsMenuOpen,
  controlledSetIsMenuOpen,
} = {}) {
  const isScrollVisible = useScrollDirection(10, 100);

  // ─── Menu State (controlled or internal) ────────────────────────────
  const [internalIsMenuOpen, setInternalIsMenuOpen] = useState(() => {
    const saved = localStorage.getItem('master-header-menu-open');
    return saved === 'true';
  });

  const isMenuOpen = controlledIsMenuOpen !== undefined 
    ? controlledIsMenuOpen 
    : internalIsMenuOpen;
  const setIsMenuOpen = controlledSetIsMenuOpen !== undefined 
    ? controlledSetIsMenuOpen 
    : setInternalIsMenuOpen;

  // ─── Persist menu state ─────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('master-header-menu-open', isMenuOpen);
  }, [isMenuOpen]);

  // ─── Mutual Exclusivity: Task Modal closes overlays ─────────────────
  useEffect(() => {
    if (isTaskModalOpen) {
      setIsMenuOpen(false);
      if (isSubSidebarOpen && onSidebarToggle) onSidebarToggle(false);
    }
  }, [isTaskModalOpen, isSubSidebarOpen, onSidebarToggle, setIsMenuOpen]);

  // ─── Tray Visibility Callback ───────────────────────────────────────
  const [isTrayVisible, setIsTrayVisible] = useState(true);
  
  const handleTrayVisibilityChange = useCallback((visible) => {
    setIsTrayVisible(visible);
  }, []);

  // Sync scroll visibility to tray
  useEffect(() => {
    setIsTrayVisible(isScrollVisible);
  }, [isScrollVisible]);

  return {
    isMenuOpen,
    setIsMenuOpen,
    isScrollVisible,
    isTrayVisible,
    handleTrayVisibilityChange,
  };
}
