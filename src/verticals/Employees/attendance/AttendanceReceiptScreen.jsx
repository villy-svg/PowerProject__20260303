/**
 * AttendanceReceiptScreen.jsx
 *
 * Full-screen digital receipt displayed after a successful check-in or check-out.
 * Provides a shareable summary via WhatsApp (Web Share API with deep link fallback).
 *
 * Props:
 *   successData - { action, record, deviceId, geolocation, timestamp, hubName }
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

import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  const accuracyTag = geolocation?.accuracy != null ? ` (±${Math.round(geolocation.accuracy)}m)` : '';
  const geoTag = geolocation
    ? `📍 ${geolocation.lat.toFixed(5)}, ${geolocation.lng.toFixed(5)}${accuracyTag}`
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
  const { action, record, deviceId, geolocation, timestamp, hubName: successHubName } = successData || {};

  // Fix A: use successData.hubName directly — the hub the employee actually checked in/out at.
  // Previously seeded from record.employees.hubs.name which is the employee's PROFILE hub
  // (e.g. Kadubeesanahalli for Ebinezer) and NOT the hub they selected at check-in time.
  // The race: useMemo baked the wrong hub into shareText before the async correction landed.
  const hubName = successHubName || '—';
  const [resolvedEmpName, setResolvedEmpName] = useState(record?.employees?.full_name || user?.name || 'Employee');
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Fix C: hub name is now pre-resolved upstream (successData.hubName) so we no longer
    // need an async DB lookup here. Only resolve the employee name if the join didn't
    // return it (e.g. RPC result didn't include the full employees join).
    const fetchEmployeeName = async () => {
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
    };

    fetchEmployeeName();
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

  const geoAccuracyDisplay = geolocation?.accuracy != null ? ` (±${Math.round(geolocation.accuracy)}m)` : '';
  const geoDisplay = geolocation
    ? `${geolocation.lat.toFixed(5)}, ${geolocation.lng.toFixed(5)}${geoAccuracyDisplay}`
    : 'Location not captured';

  // ---------------------------------------------------------------------------
  // WhatsApp Share Handler
  // On native Capacitor (Android/iOS): open WhatsApp deep link directly because
  // Chromium WebView exposes navigator.share but frequently rejects/fails it
  // without opening any share sheet.
  // On web: try Web Share API first; on any non-cancel failure, fall through
  // to the wa.me deep link.
  // IMPORTANT: Never auto-dismiss the receipt (onDone) here — let the employee
  // explicitly tap "Done" after confirming their message was sent in the group.
  // ---------------------------------------------------------------------------
  const openWhatsAppDeepLink = (text) => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (!popup) {
      // Fallback when WebView or mobile browser blocks window.open
      window.location.href = url;
    }
  };

  const handleWhatsAppShare = async () => {
    let isNative = false;
    try {
      const { Capacitor } = await import('@capacitor/core');
      isNative = Capacitor?.isNativePlatform() || false;
    } catch {
      // Web environment
    }

    if (isNative) {
      openWhatsAppDeepLink(shareText);
      return;
    }

    // Web platform guard per hybrid-mobile-deployment §4
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') {
          // User explicitly dismissed the share sheet — stay on receipt
          return;
        }
        console.warn('[AttendanceReceiptScreen] navigator.share failed, falling back to wa.me:', err);
      }
    }

    openWhatsAppDeepLink(shareText);
  };

  // ---------------------------------------------------------------------------
  // Copy Message Handler — reliable fallback for pasting into WhatsApp groups
  // Uses Clipboard API with a legacy textarea fallback for Android 8 WebViews.
  // ---------------------------------------------------------------------------
  const handleCopyMessage = async () => {
    let didCopy = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        didCopy = true;
      }
    } catch {
      // Fall through to legacy execCommand fallback
    }

    if (!didCopy) {
      try {
        const el = document.createElement('textarea');
        el.value = shareText;
        el.setAttribute('readonly', '');
        el.className = 'receipt__copy-buffer';
        document.body.appendChild(el);
        el.select();
        didCopy = document.execCommand('copy');
        document.body.removeChild(el);
      } catch (err) {
        console.warn('[AttendanceReceiptScreen] Fallback copy failed:', err);
      }
    }

    if (didCopy) {
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }
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

        {/* Secondary actions: Copy for manual paste + explicit Done */}
        <div className="receipt__secondary-actions">
          <button
            id="receipt-copy-btn"
            type="button"
            className="halo-button receipt__secondary-btn"
            onClick={handleCopyMessage}
          >
            {copied ? '✓ Copied!' : '📋 Copy Message'}
          </button>
          <button
            id="receipt-done-btn"
            type="button"
            className="halo-button receipt__secondary-btn receipt__secondary-btn--done"
            onClick={onDone}
          >
            Done
          </button>
        </div>
      </div>

    </div>
  );
};

export default AttendanceReceiptScreen;
