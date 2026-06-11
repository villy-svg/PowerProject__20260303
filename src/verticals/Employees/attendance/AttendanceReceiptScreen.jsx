/**
 * AttendanceReceiptScreen.jsx
 *
 * Full-screen digital receipt displayed after a successful check-in or check-out.
 * Provides a shareable summary via WhatsApp (Web Share API with deep link fallback).
 *
 * Props:
 *   successData - { action, record, deviceId, geolocation, timestamp }
 *                 from useAttendanceSelfService
 *   user        - The logged-in user object
 *   onDone      - Function() → clears successData and returns to self-service screen
 *
 * Skill compliance:
 *   hybrid-mobile-deployment §4 (Navigator.share guard — not available in all browsers)
 *   ui-design-system §12 (Premium glassmorphism card design)
 *   ui-design-system §14B (Touch targets ≥ 44px enforced in CSS)
 *   safe-code-modification §2 (No inline styles)
 */

import React, { useMemo } from 'react';
import './AttendanceSelfService.css';

// ---------------------------------------------------------------------------
// Utility: Build the plain-text WhatsApp share message
// ---------------------------------------------------------------------------
function buildShareText({ action, record, deviceId, geolocation, timestamp, employeeName, hubName }) {
  const actionLabel = action === 'checkin' ? '✅ Shift Started' : '👋 Shift Ended';
  const shiftLabel  = record?.shift_type === 'day' ? '☀ Day Shift' : '🌙 Night Shift';
  const timeDisplay = new Date(timestamp).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  // Geolocation tag (human-readable lat/lng or 'Unavailable')
  const geoTag = geolocation
    ? `📍 ${geolocation.lat.toFixed(5)}, ${geolocation.lng.toFixed(5)} (±${Math.round(geolocation.accuracy)}m)`
    : '📍 Location unavailable';

  return [
    `*PowerProject Attendance*`,
    ``,
    `${actionLabel}`,
    `👤 ${employeeName}`,
    `🏢 ${hubName || 'Hub N/A'}`,
    `🔄 ${shiftLabel}`,
    `🕐 ${timeDisplay}`,
    `${geoTag}`,
    `📱 Device: ${deviceId?.slice(-8) || 'Unknown'}`, // Show last 8 chars of device ID
  ].join('\n');
}

// ---------------------------------------------------------------------------
// AttendanceReceiptScreen — main export
// ---------------------------------------------------------------------------
const AttendanceReceiptScreen = ({ successData, user, onDone }) => {
  const { action, record, deviceId, geolocation, timestamp } = successData || {};

  // Resolve display names from the nested record data
  const employeeName = record?.employees?.full_name || user?.name || 'Employee';
  const hubName      = record?.employees?.hubs?.name || record?.employees?.hubs?.hub_code || '—';
  const shiftLabel   = record?.shift_type === 'day' ? '☀ Day Shift' : '🌙 Night Shift';
  const actionLabel  = action === 'checkin' ? '✅ Shift Started' : '👋 Shift Ended';
  const actionClass  = action === 'checkin' ? 'receipt__card--checkin' : 'receipt__card--checkout';

  // Memoize share text to avoid rebuilding on every render
  const shareText = useMemo(() => buildShareText({
    action, record, deviceId, geolocation, timestamp, employeeName, hubName,
  }), [action, record, deviceId, geolocation, timestamp, employeeName, hubName]);

  // Format timestamp for display
  const timeDisplay = timestamp
    ? new Date(timestamp).toLocaleString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
      })
    : '—';

  const geoDisplay = geolocation
    ? `${geolocation.lat.toFixed(5)}, ${geolocation.lng.toFixed(5)} (±${Math.round(geolocation.accuracy)}m)`
    : 'Location not captured';

  // ---------------------------------------------------------------------------
  // WhatsApp Share Handler
  // Primary: Web Share API (guards against unsupported browsers)
  // Fallback: WhatsApp deep link URL
  // ---------------------------------------------------------------------------
  const handleWhatsAppShare = async () => {
    const encoded = encodeURIComponent(shareText);

    // Platform guard per hybrid-mobile-deployment §4
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch (err) {
        // User cancelled share — fall through to deep link fallback
        if (err.name !== 'AbortError') {
          console.warn('[AttendanceReceiptScreen] navigator.share error:', err);
        }
      }
    }

    // Fallback: wa.me deep link (works on all platforms)
    window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="receipt__container">
      {/* Receipt Card */}
      <div className={`receipt__card ${actionClass}`}>
        {/* Action Header */}
        <div className="receipt__action-header">
          <p className="receipt__action-label">{actionLabel}</p>
        </div>

        {/* Employee Details */}
        <div className="receipt__details">
          <div className="receipt__detail-row">
            <span className="receipt__detail-icon">👤</span>
            <div>
              <p className="receipt__detail-label">EMPLOYEE</p>
              <p className="receipt__detail-value">{employeeName}</p>
            </div>
          </div>

          <div className="receipt__detail-row">
            <span className="receipt__detail-icon">🔄</span>
            <div>
              <p className="receipt__detail-label">SHIFT</p>
              <p className="receipt__detail-value">{shiftLabel}</p>
            </div>
          </div>

          <div className="receipt__detail-row">
            <span className="receipt__detail-icon">🏢</span>
            <div>
              <p className="receipt__detail-label">HUB</p>
              <p className="receipt__detail-value">{hubName}</p>
            </div>
          </div>

          <div className="receipt__detail-row">
            <span className="receipt__detail-icon">🕐</span>
            <div>
              <p className="receipt__detail-label">TIMESTAMP</p>
              <p className="receipt__detail-value">{timeDisplay}</p>
            </div>
          </div>

          <div className="receipt__detail-row">
            <span className="receipt__detail-icon">📍</span>
            <div>
              <p className="receipt__detail-label">LOCATION</p>
              <p className="receipt__detail-value receipt__detail-value--geo">{geoDisplay}</p>
            </div>
          </div>

          <div className="receipt__detail-row">
            <span className="receipt__detail-icon">📱</span>
            <div>
              <p className="receipt__detail-label">DEVICE ID</p>
              <p className="receipt__detail-value receipt__detail-value--mono">
                {deviceId ? `…${deviceId.slice(-12)}` : 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        {/* WhatsApp Share CTA */}
        <button
          id="receipt-whatsapp-share-btn"
          className="halo-button receipt__share-btn"
          onClick={handleWhatsAppShare}
        >
          <span className="receipt__share-icon">💬</span>
          Share to WhatsApp
        </button>
      </div>

      {/* Done button — returns to self-service screen */}
      <button
        id="receipt-done-btn"
        className="halo-button receipt__done-btn"
        onClick={onDone}
      >
        Done
      </button>
    </div>
  );
};

export default AttendanceReceiptScreen;
