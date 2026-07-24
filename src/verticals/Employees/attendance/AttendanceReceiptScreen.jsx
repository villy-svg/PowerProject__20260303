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

import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../../../services/core/supabaseClient';
import './AttendanceSelfService.css';

// ---------------------------------------------------------------------------
// Utility: Format metres for display.
// Always shows in metres (e.g., "1234 m") | null → "—"
// ---------------------------------------------------------------------------
function formatDistance(metres) {
  if (metres === null || metres === undefined) return '—';
  return `${Math.round(metres)} m`;
}

// ---------------------------------------------------------------------------
// Utility: Build the plain-text WhatsApp share message
// ---------------------------------------------------------------------------
function buildShareText({ action, record, deviceId, geolocation, timestamp, employeeName, hubName, distanceFromHub }) {
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
    `👤 ${employeeName} ${actionLabel} at 🏢 ${hubName || 'Hub N/A'}`,
    ``,
    `${shiftLabel}`,
    `🕐 ${timeDisplay}`,
    `${geoTag}`,
    `📱 Device: ${deviceId?.slice(-8) || 'Unknown'}`, // Show last 8 chars of device ID
    `📏 Dist. from Hub: ${formatDistance(distanceFromHub)}${distanceFromHub != null && distanceFromHub > 50 ? ' *CHECK LOCATION*' : ''}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// AttendanceReceiptScreen — main export
// ---------------------------------------------------------------------------
const AttendanceReceiptScreen = ({ successData, user, onDone }) => {
  const { action, record, deviceId, geolocation, timestamp } = successData || {};

  const [resolvedHubName, setResolvedHubName] = useState('—');
  const [resolvedEmpName, setResolvedEmpName] = useState(user?.name || 'Employee');

  useEffect(() => {
    const fetchNames = async () => {
      // 1. Resolve employee name
      if (record?.employees?.full_name) {
        setResolvedEmpName(record.employees.full_name);
      } else if (record?.employee_id) {
        const { data: empData } = await supabase
          .from('employees')
          .select('full_name')
          .eq('id', record.employee_id)
          .single();
        if (empData?.full_name) {
          setResolvedEmpName(empData.full_name);
        }
      }

      // 2. Resolve hub name
      //    We use session_logs_data to find the relevant hub_id.
      if (record?.employees?.hubs?.name) {
        setResolvedHubName(record.employees.hubs.name);
      } else {
        // Find hub_id from the last session in session_logs_data
        let sessions = record?.session_logs_data || [];
        if (typeof sessions === 'string') {
          try { sessions = JSON.parse(sessions); } catch (e) { sessions = []; }
        }
        const lastSession = sessions[sessions.length - 1];
        const hubId = lastSession?.hub_id;

        if (hubId) {
          const { data: hubData } = await supabase
            .from('hubs')
            .select('name, hub_code')
            .eq('id', hubId)
            .single();
          if (hubData) {
            setResolvedHubName(hubData.name || hubData.hub_code || '—');
          }
        }
      }
    };

    fetchNames();
  }, [record, user]);

  // ---------------------------------------------------------------------------
  // Resolve distance_from_hub_m from the last session log entry.
  // On check-in:  the new open session already carries the distance.
  // On check-out: the RPC closes the open session and writes the distance there.
  // We always read from the last entry in session_logs_data.
  // ---------------------------------------------------------------------------
  const distanceFromHub = useMemo(() => {
    let sessions = record?.session_logs_data || [];
    if (typeof sessions === 'string') {
      try { sessions = JSON.parse(sessions); } catch (e) { sessions = []; }
    }
    const lastSession = sessions[sessions.length - 1];
    const raw = lastSession?.distance_from_hub_m;
    // Treat explicit null as null (hub has no coords); undefined also → null.
    return raw !== undefined ? raw : null;
  }, [record]);

  const employeeName = resolvedEmpName;
  const hubName      = resolvedHubName;
  const shiftLabel   = record?.shift_type === 'day' ? '☀ Day Shift' : '🌙 Night Shift';
  const actionLabel  = action === 'checkin' ? '✅ Shift Started' : '👋 Shift Ended';
  const actionClass  = action === 'checkin' ? 'receipt__card--checkin' : 'receipt__card--checkout';

  // Memoize share text to avoid rebuilding on every render
  const shareText = useMemo(() => buildShareText({
    action, record, deviceId, geolocation, timestamp, employeeName, hubName, distanceFromHub,
  }), [action, record, deviceId, geolocation, timestamp, employeeName, hubName, distanceFromHub]);

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
      } catch (err) {
        // User cancelled share — fall through to deep link fallback
        if (err.name !== 'AbortError') {
          console.warn('[AttendanceReceiptScreen] navigator.share error:', err);
        }
      } finally {
        // Automatically finish the flow after the share sheet closes (even if cancelled)
        onDone();
      }
      return;
    }

    // Fallback: wa.me deep link (works on all platforms)
    window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer');
    
    // Automatically finish the flow after opening the fallback share link
    onDone();
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

          {/* Distance from Hub — populated by the database RPC after check-in/out */}
          <div className="receipt__detail-row">
            <span className="receipt__detail-icon">📏</span>
            <div>
              <p className="receipt__detail-label">DIST. FROM HUB</p>
              <p className="receipt__detail-value">
                {formatDistance(distanceFromHub)}
                {distanceFromHub != null && distanceFromHub > 50 && (
                  <span className="receipt__location-warning"> CHECK LOCATION</span>
                )}
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

    </div>
  );
};

export default AttendanceReceiptScreen;
