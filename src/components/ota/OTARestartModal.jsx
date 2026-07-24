/**
 * OTARestartModal.jsx
 *
 * Modal shown after the OTA bundle has been fully downloaded and applied.
 * The user can restart the app immediately to activate the new version,
 * or dismiss and let it apply on the next natural restart.
 *
 * Props:
 *  - currentVersion  {string}   — Installed version e.g. "2.3.2"
 *  - newVersion      {string}   — Downloaded version e.g. "2.3.5"
 *  - onRestartNow    {function} — Calls CapacitorUpdater.reload()
 *  - onRestartLater  {function} — Dismisses the modal
 *
 * Skill compliance:
 * - UI Design System: squircle radius, halo-button, CSS variables only
 * - Runtime Stability: all props safely accessed
 * - Hybrid Mobile: caller is responsible for platform guard
 */

import React from 'react';
import './OTARestartModal.css';

const OTARestartModal = ({ currentVersion, newVersion, onRestartNow, onRestartLater }) => {
  return (
    <div className="ota-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ota-modal-title">
      <div className="ota-modal">
        {/* Icon Header */}
        <div className="ota-modal__icon-wrap" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
          </svg>
        </div>

        {/* Title */}
        <h2 className="ota-modal__title" id="ota-modal-title">
          Update Ready
        </h2>

        {/* Version pill */}
        <div className="ota-modal__version-row">
          {currentVersion && (
            <span className="ota-modal__version-chip ota-modal__version-chip--old">
              v{currentVersion}
            </span>
          )}
          <span className="ota-modal__arrow" aria-hidden="true">→</span>
          {newVersion && (
            <span className="ota-modal__version-chip ota-modal__version-chip--new">
              v{newVersion}
            </span>
          )}
        </div>

        {/* Description */}
        <p className="ota-modal__description">
          The new version has been downloaded and is ready to install.
          Restart now to activate it, or continue and it will apply automatically on next launch.
        </p>

        {/* Action buttons */}
        <div className="ota-modal__actions">
          <button
            id="ota-restart-now-btn"
            className="halo-button ota-modal__btn-primary"
            onClick={onRestartNow}
          >
            Restart Now
          </button>
          <button
            id="ota-restart-later-btn"
            className="ota-modal__btn-secondary"
            onClick={onRestartLater}
          >
            Restart Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default OTARestartModal;
