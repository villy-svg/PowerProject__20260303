/**
 * LiveAttendanceTab.jsx
 *
 * Displays all currently active (clocked-in) employees, grouped by hub.
 * Excludes aggregate hubs (ALL, MULTI — handled at service layer).
 * Shows live hours worked and an "Overtime" badge for sessions ≥ 12 hours.
 *
 * Skill compliance:
 *   ui-design-system §3  (Standardized badge system)
 *   ui-design-system §7  (Global 4-color status palette — Warning for overtime)
 *   ui-design-system §12 (Premium glassmorphism design)
 *   safe-code-modification §2 (BEM naming, no inline styles)
 *   development-best-practices §4 (Single-responsibility sub-components)
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLiveAttendance } from '../../../hooks/useLiveAttendance';
import { adminForceCheckout } from '../../../services/employees/attendanceService';

// ---------------------------------------------------------------------------
// Utility: Format decimal hours into "Xh Ym" string (e.g. 1.5 → "1h 30m")
// ---------------------------------------------------------------------------
function formatHours(hours) {
  if (hours < 0) return '0h 0m';
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// LiveHoursCounter
// Ticks every minute to keep the displayed hours up-to-date.
// Receives the loginTime ISO string and overtime threshold (hours).
// ---------------------------------------------------------------------------
const LiveHoursCounter = ({ loginTime, standardShiftHours }) => {
  const [hoursWorked, setHoursWorked] = useState(() => {
    if (!loginTime) return 0;
    return (Date.now() - new Date(loginTime).getTime()) / (1000 * 60 * 60);
  });

  // Tick every 60 seconds to update the live counter
  const tickRef = useRef(null);
  useEffect(() => {
    if (!loginTime) return;
    const computeHours = () => {
      const diff = (Date.now() - new Date(loginTime).getTime()) / (1000 * 60 * 60);
      setHoursWorked(Math.max(0, diff));
    };
    tickRef.current = setInterval(computeHours, 60_000);
    return () => clearInterval(tickRef.current);
  }, [loginTime]);

  const isOvertime = hoursWorked >= standardShiftHours;

  return (
    <span className={`live-attendance__hours${isOvertime ? ' live-attendance__hours--overtime' : ''}`}>
      {formatHours(hoursWorked)}
    </span>
  );
};

// ---------------------------------------------------------------------------
// UserRow — a single employee entry inside a hub card
// ---------------------------------------------------------------------------
const UserRow = ({ session, standardShiftHours, isMasterAdmin, onForceCheckout, now }) => {
  const hoursWorked = (now - new Date(session.loginTime).getTime()) / (1000 * 60 * 60);
  const isOvertime  = hoursWorked >= standardShiftHours;
  const [isEnding, setIsEnding] = useState(false);

  const handleEndShift = async () => {
    if (window.confirm(`Force end shift for ${session.fullName}?`)) {
      setIsEnding(true);
      await onForceCheckout(session.recordId, session.sessions);
      setIsEnding(false);
    }
  };

  return (
    <div className={`live-attendance__user-row${isOvertime ? ' live-attendance__user-row--overtime' : ''}`}>
      <div className="live-attendance__user-info">
        <div className="live-attendance__user-name-row u-block u-mb-2">
          <span className="live-attendance__user-name u-fw-600">{session.fullName}</span>
        </div>
        <div className="live-attendance__user-meta-row u-flex-center-gap-8">
          <span className="live-attendance__emp-code">{session.empCode}</span>
        </div>
      </div>
      <div className="live-attendance__user-meta">
        <span className="live-attendance__shift-badge">
          {session.shiftType === 'day' ? '☀' : '🌙'}
        </span>
        {isOvertime && (
          <span className="live-attendance__overtime-badge">OVERTIME</span>
        )}
        <LiveHoursCounter loginTime={session.loginTime} standardShiftHours={standardShiftHours} />
        {isMasterAdmin && (
          <button 
            className="halo-button live-attendance__force-end-btn"
            onClick={handleEndShift}
            disabled={isEnding}
            title="Force End Shift"
          >
            {isEnding ? 'Ending...' : '🚫'}
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// HubCard — collapses/expands the list of users for a hub
// ---------------------------------------------------------------------------
const HubCard = ({ hubGroup, standardShiftHours, isMasterAdmin, onForceCheckout, now }) => {
  const { hub, sessions } = hubGroup;
  const overtimeCount = sessions.filter(s => {
    const hours = (now - new Date(s.loginTime).getTime()) / (1000 * 60 * 60);
    return hours >= standardShiftHours;
  }).length;

  return (
    <div className="live-attendance__hub-card">
      <div className="live-attendance__hub-header">
        <div className="live-attendance__hub-title-group">
          <span className="live-attendance__hub-code">{hub.hub_code}</span>
          <span className="live-attendance__hub-name">{hub.name}</span>
        </div>
        <div className="live-attendance__hub-counts">
          {overtimeCount > 0 && (
            <span className="live-attendance__hub-overtime-count">
              {overtimeCount} OT
            </span>
          )}
          <span className="live-attendance__hub-active-count">
            {sessions.length} active
          </span>
        </div>
      </div>
      <div className="live-attendance__user-list">
        {sessions.map(session => (
          <UserRow
            key={session.employeeId}
            session={session}
            standardShiftHours={standardShiftHours}
            isMasterAdmin={isMasterAdmin}
            onForceCheckout={onForceCheckout}
            now={now}
          />
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// LiveAttendanceTab — main export
// ---------------------------------------------------------------------------
const LiveAttendanceTab = ({ user }) => {
  const {
    hubGroups,
    totalActive,
    isLoading,
    error,
    lastRefresh,
    refresh,
    STANDARD_SHIFT_HOURS,
  } = useLiveAttendance();

  const isMasterAdmin = user?.roleId === 'master_admin';

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleForceCheckout = async (recordId, currentSessions) => {
    const { error } = await adminForceCheckout(recordId, currentSessions);
    if (!error) {
      refresh(); // Reload to remove the checked-out session from live view
    } else {
      alert(`Failed to force checkout: ${error.message || 'Unknown error'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="live-attendance__loading">
        <div className="self-service__loading-spinner" />
        <p>Loading live attendance…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="live-attendance__error">
        <p>⚠ {error}</p>
        <button className="halo-button" onClick={refresh}>Retry</button>
      </div>
    );
  }

  const lastRefreshLabel = lastRefresh
    ? lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="live-attendance__container">
      {/* Summary bar */}
      <div className="live-attendance__summary-bar">
        <span className="live-attendance__summary-count">
          <span className="live-attendance__pulse-dot" />
          {totalActive} currently active
        </span>
        <button
          className="live-attendance__refresh-btn halo-button"
          onClick={refresh}
          title="Refresh live data"
        >
          ↺ Refresh
        </button>
      </div>
      <p className="live-attendance__last-refresh">Last updated {lastRefreshLabel}</p>

      {/* Hub cards */}
      {hubGroups.length === 0 ? (
        <div className="live-attendance__empty">
          <p className="live-attendance__empty-icon">🏢</p>
          <p className="live-attendance__empty-text">No active sessions right now.</p>
        </div>
      ) : (
        <div className="live-attendance__hub-grid">
          {hubGroups.map(group => (
            <HubCard
              key={group.hub.id}
              hubGroup={group}
              standardShiftHours={STANDARD_SHIFT_HOURS}
              isMasterAdmin={isMasterAdmin}
              onForceCheckout={handleForceCheckout}
              now={now}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveAttendanceTab;
