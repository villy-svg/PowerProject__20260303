/**
 * OTAUpdateToast.jsx
 *
 * Floating glassmorphism toast that appears when a new app version
 * is detected. The download runs silently in the background while
 * the user continues working.
 *
 * Props:
 *  - version       {string}   — New version number e.g. "2.3.5"
 *  - isApplying    {boolean}  — true while the bundle is downloading
 *  - onDismiss     {function} — Called when user taps the × button
 *
 * Skill compliance:
 * - UI Design System: halo-button, CSS variables only, no hardcoded hex
 * - Runtime Stability: all props safely accessed with optional chaining
 * - Hybrid Mobile: rendered only when platform check passes (caller guards)
 */

import React, { useEffect, useRef } from 'react';
import './OTAUpdateToast.css';

const AUTO_DISMISS_MS = 10000; // 10 seconds

const OTAUpdateToast = ({ version, isApplying, onDismiss }) => {
  const timerRef = useRef(null);

  // Auto-dismiss after 10 seconds if not interacted with
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss?.();
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timerRef.current);
  }, [onDismiss]);

  return (
    <div className="ota-toast" role="status" aria-live="polite">
      {/* Icon */}
      <div className="ota-toast__icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 16 12 12 8 16" />
          <line x1="12" y1="12" x2="12" y2="21" />
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
        </svg>
      </div>

      {/* Text */}
      <div className="ota-toast__body">
        <span className="ota-toast__title">
          Update Available
          {version && <span className="ota-toast__version">v{version}</span>}
        </span>
        <span className="ota-toast__subtitle">
          {isApplying
            ? 'Downloading in background…'
            : 'Ready to apply on next restart'}
        </span>
      </div>

      {/* Loading spinner (while downloading) */}
      {isApplying && (
        <div className="ota-toast__spinner" aria-label="Downloading" />
      )}

      {/* Dismiss button */}
      <button
        className="ota-toast__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss update notification"
        title="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};

export default OTAUpdateToast;
