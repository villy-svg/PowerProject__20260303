/**
 * AttendanceSelfService.jsx
 *
 * Employee-facing check-in / check-out screen — now called "Current Attendance".
 *
 * Layout variants:
 *   - Viewer: Single-tab — the check-in/check-out form only.
 *   - Contributor+: Two tabs — "Current Attendance" (form) + "Live Attendance" (hub view).
 *
 * Features:
 *   - 12-hour shift alarm (via browser Notification API or in-page banner fallback).
 *   - RBACManageButton visible only to master_admin, labelled "Current Attendance".
 *
 * Skill compliance:
 *   hybrid-mobile-deployment §4 (Platform guards via useAttendanceSelfService hook)
 *   ui-design-system §14B (Touch targets ≥ 44px — enforced in CSS)
 *   development-best-practices §4 (Strict modularity — sub-components extracted)
 *   safe-code-modification §2 (No inline styles)
 *   rbac-security-system §2 (Viewer can submit attendance; tab guard uses canCreate)
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../services/core/supabaseClient';
import { useAttendanceSelfService } from '../../../hooks/useAttendanceSelfService';
import AttendanceReceiptScreen from './AttendanceReceiptScreen';
import LiveAttendanceTab from './LiveAttendanceTab';
import RBACManageButton from '../../../components/RBACManageButton';
import './AttendanceSelfService.css';

// ---------------------------------------------------------------------------
// HubSelector — fetches hubs and renders a select element.
// Extracted as a sub-component to follow single-responsibility principle.
// ---------------------------------------------------------------------------
const HubSelector = ({ selectedHubId, onSelect }) => {
  const [hubs, setHubs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHubs = async () => {
      const { data } = await supabase
        .from('hubs')
        .select('id, name, hub_code')
        .eq('status', 'active')
        .order('name');
      setHubs(data || []);
      setLoading(false);
    };
    fetchHubs();
  }, []);

  return (
    <div className="form-group self-service__hub-group">
      <label className="form-label" htmlFor="self-service-hub-select">SELECT HUB</label>
      <div className="form-input-container">
        <select
          id="self-service-hub-select"
          className="master-dropdown"
          value={selectedHubId || ''}
          onChange={(e) => onSelect(e.target.value || null)}
          required
        >
          <option value="">— Choose your hub —</option>
          {!loading && hubs.map(hub => (
            <option key={hub.id} value={hub.id}>
              {hub.hub_code} — {hub.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ShiftTypeIndicator — read-only display of the auto-detected shift type.
// No user interaction; the shift is determined by getDefaultShiftType().
// ---------------------------------------------------------------------------
const ShiftTypeIndicator = ({ value }) => (
  <div className="form-group self-service__shift-group">
    <label className="form-label">SHIFT TYPE</label>
    <div className="form-input-container self-service__shift-indicator">
      <span className="self-service__shift-indicator-icon">
        {value === 'day' ? '☀' : '🌙'}
      </span>
      <span className="self-service__shift-indicator-label">
        {value === 'day' ? 'Day Shift' : 'Night Shift'}
      </span>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// ActiveSessionCard — shown when employee is already checked in
// ---------------------------------------------------------------------------
const ActiveSessionCard = ({ record }) => {
  const sessions = record?.session_logs_data || [];
  // Find the open session (the one with no logout_time)
  const activeSession = sessions.find(s => s.logout_time === null);
  const loginTime = activeSession?.login_time
    ? new Date(activeSession.login_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="self-service__active-card">
      <div className="self-service__active-icon">✅</div>
      <h2 className="self-service__active-title">Shift In Progress</h2>
      <p className="self-service__active-shift">
        {record?.shift_type === 'day' ? '☀ Day Shift' : '🌙 Night Shift'}
      </p>
      <p className="self-service__active-time">Started at {loginTime}</p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// AlarmBanner — in-page fallback when browser Notifications are not granted
// ---------------------------------------------------------------------------
const AlarmBanner = ({ onDismiss }) => (
  <div className="self-service__alarm-banner" role="alert" aria-live="assertive">
    <span className="self-service__alarm-icon">⏰</span>
    <div className="self-service__alarm-body">
      <strong className="self-service__alarm-title">12-Hour Shift Alert</strong>
      <p className="self-service__alarm-text">
        You have been on shift for 12 hours. Please remember to end your shift!
      </p>
    </div>
    <button
      className="self-service__alarm-dismiss"
      onClick={onDismiss}
      aria-label="Dismiss overtime reminder"
    >
      ✕
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// CurrentAttendanceTab — the main check-in / check-out form area
// ---------------------------------------------------------------------------
const CurrentAttendanceTab = ({ user }) => {
  const {
    todayRecord,
    hasActiveSession,
    successData,
    isLoading,
    isActing,
    error,
    alarmFired,
    dismissAlarm,
    selectedShiftType, setSelectedShiftType,
    selectedHubId, setSelectedHubId,
    handleCheckIn,
    handleCheckOut,
    clearSuccessData,
  } = useAttendanceSelfService();

  // Receipt screen routing: show receipt after successful check-in/out
  if (successData) {
    return (
      <AttendanceReceiptScreen
        successData={successData}
        user={user}
        onDone={clearSuccessData}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="self-service__loading">
        <div className="self-service__loading-spinner" />
        <p>Loading your attendance status…</p>
      </div>
    );
  }

  return (
    <>
      {/* 12-hour alarm fallback banner */}
      {alarmFired && <AlarmBanner onDismiss={dismissAlarm} />}

      {/* Error display */}
      {error && (
        <div className="self-service__error">
          <p>⚠ {error}</p>
        </div>
      )}

      {hasActiveSession ? (
        /* State 2: Active session — show End Shift button */
        <>
          <ActiveSessionCard record={todayRecord} />
          <button
            id="self-service-checkout-btn"
            className="halo-button self-service__action-btn self-service__checkout-btn"
            onClick={handleCheckOut}
            disabled={isActing}
          >
            {isActing ? 'Logging Out…' : '👋 End Shift'}
          </button>
        </>
      ) : (
        /* State 1: No active session — show check-in form */
        <form
          className="self-service__form"
          onSubmit={(e) => { e.preventDefault(); handleCheckIn(); }}
        >
          <HubSelector
            selectedHubId={selectedHubId}
            onSelect={setSelectedHubId}
          />
          <ShiftTypeIndicator
            value={selectedShiftType}
          />
          <button
            id="self-service-checkin-btn"
            type="submit"
            className="halo-button self-service__action-btn self-service__checkin-btn"
            disabled={isActing || !selectedHubId}
          >
            {isActing ? 'Starting Shift…' : '✅ Start Shift'}
          </button>
        </form>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// TAB CONSTANTS
// ---------------------------------------------------------------------------
const TAB_CURRENT  = 'current';
const TAB_LIVE     = 'live';

// ---------------------------------------------------------------------------
// AttendanceSelfService — main export
// Accepts `permissions` from ContentRouter to determine the tab layout.
// Viewer: single tab (form only). Contributor+: two tabs.
// ---------------------------------------------------------------------------
const AttendanceSelfService = ({ user, permissions }) => {
  // Contributor+ can create records — use canCreate as the tab gate.
  // Viewer has canCreate === false but can still submit via the SECURITY DEFINER RPC.
  const showLiveTab = !!(permissions?.canCreate);
  const [activeTab, setActiveTab] = useState(TAB_CURRENT);

  const todayDisplay = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="self-service__container">
      {/* Page Header */}
      <div className="self-service__header self-service__header--spaced">
        <div>
          <h1 className="self-service__title">Current Attendance</h1>
          <p className="self-service__date">{todayDisplay}</p>
        </div>
        {/* master_admin only — the RBACManageButton is self-guarded */}
        <RBACManageButton
          user={user}
          verticalId="employees"
          featureId="canAccessAttendanceSelfService"
          label="Current Attendance"
        />
      </div>

      {/* Tab bar — only shown for Contributor+ */}
      {showLiveTab && (
        <div className="self-service__tabs" role="tablist" aria-label="Attendance views">
          <button
            id="tab-btn-current"
            role="tab"
            aria-selected={activeTab === TAB_CURRENT}
            className={`self-service__tab-btn${activeTab === TAB_CURRENT ? ' self-service__tab-btn--active' : ''}`}
            onClick={() => setActiveTab(TAB_CURRENT)}
          >
            Current Attendance
          </button>
          <button
            id="tab-btn-live"
            role="tab"
            aria-selected={activeTab === TAB_LIVE}
            className={`self-service__tab-btn${activeTab === TAB_LIVE ? ' self-service__tab-btn--active' : ''}`}
            onClick={() => setActiveTab(TAB_LIVE)}
          >
            <span className="self-service__tab-pulse" />
            Live Attendance
          </button>
        </div>
      )}

      {/* Tab content */}
      {activeTab === TAB_CURRENT || !showLiveTab ? (
        <CurrentAttendanceTab user={user} />
      ) : (
        <LiveAttendanceTab />
      )}
    </div>
  );
};

export default AttendanceSelfService;
