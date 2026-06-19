/**
 * ExitAppModal.jsx
 *
 * Native-only confirmation modal that appears when the user presses the
 * hardware back button on the Dashboard (the root screen).
 * On web, this component renders nothing — the platform guard is internal.
 *
 * Usage: Rendered inside MobileLayout.jsx. Reads showExitModal from context.
 *
 * Skill compliance:
 * - hybrid-mobile-deployment §4 Platform Guards
 * - ui-design-system §5 Modals, §12 Apple-Inspired Premium Design
 */
import React, { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAppNavigation } from '../../app/contexts/AppNavigationContext';
import './ExitAppModal.css';

const ExitAppModal = () => {
  const { showExitModal, setShowExitModal } = useAppNavigation();

  // This modal only makes sense on a native platform
  if (!Capacitor.isNativePlatform()) return null;
  if (!showExitModal) return null;

  const handleExit = async () => {
    try {
      const { App } = await import('@capacitor/app');
      App.exitApp();
    } catch (err) {
      console.error('[ExitAppModal] Failed to call App.exitApp():', err);
    }
  };

  const handleStay = () => {
    setShowExitModal(false);
  };

  return (
    <div
      className="exit-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Exit Application"
      onClick={handleStay} // Tap outside to dismiss
    >
      <div
        className="exit-modal-body"
        onClick={e => e.stopPropagation()} // Prevent overlay click through
      >
        {/* Dot accent */}
        <div className="exit-modal-icon-wrap">
          <div className="exit-modal-icon-ring">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
        </div>

        <h2 className="exit-modal-title">Exit PowerProject?</h2>
        <p className="exit-modal-subtitle">Are you sure you want to close the app?</p>

        <div className="exit-modal-actions">
          <button
            id="exit-modal-stay-btn"
            className="halo-button exit-modal-stay"
            onClick={handleStay}
          >
            Stay
          </button>
          <button
            id="exit-modal-exit-btn"
            className="exit-modal-exit-btn"
            onClick={handleExit}
          >
            Exit App
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExitAppModal;
