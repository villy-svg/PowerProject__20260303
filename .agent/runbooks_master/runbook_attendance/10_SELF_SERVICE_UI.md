# Phase 4.1 — Employee Self-Service Screen (Check-In / Check-Out)

## Skills Required (Read Before Starting)
- `hybrid-mobile-deployment` §4 (Platform guards for Capacitor APIs)
- `ui-design-system` §14B (Touch targets ≥ 44px on mobile)
- `ui-design-system` §14C (Design token scaling for mobile)
- `safe-code-modification` §2C (Use `clamp()` for fluid sizing)
- `development-best-practices` §4 (Strict modularity)

---

## Objective

Create `AttendanceSelfService.jsx` — the Employee-facing check-in/check-out screen. This is a **clean, single-focus mobile-first screen** where employees:
1. Select hub + shift type → tap "Start Shift"
2. See "End Shift" button if already checked in
3. Are routed to the receipt screen on success

This is mounted via `activeVertical === 'attendance_self_service'` (a **new** vertical route added in Phase 5).

---

## UX States

```
State 1 — No Active Session:
  ┌─────────────────────────────┐
  │  🗓 ATTENDANCE CHECK-IN     │
  │  Today: Wed, 11 Jun 2026    │
  │                             │
  │  ┌─ Select Hub ───────────┐ │
  │  │  HUB-01 - Koramangala  │ │
  │  └────────────────────────┘ │
  │  ┌─ Shift Type ───────────┐ │
  │  │  ☀ Day   |  🌙 Night  │ │
  │  └────────────────────────┘ │
  │                             │
  │  ┌── START SHIFT ──────────┐ │
  │  └────────────────────────┘ │
  └─────────────────────────────┘

State 2 — Active Session:
  ┌─────────────────────────────┐
  │  ✅ SHIFT IN PROGRESS       │
  │  Day Shift | HUB-01         │
  │  Started at 09:00 AM        │
  │                             │
  │  ┌── END SHIFT ────────────┐ │
  │  └────────────────────────┘ │
  └─────────────────────────────┘
```

---

## Step 1: Create `AttendanceSelfService.jsx`

**File to create:**
```
src/verticals/Employees/attendance/AttendanceSelfService.jsx
```

**Full JSX Content:**

```jsx
/**
 * AttendanceSelfService.jsx
 *
 * Employee-facing check-in / check-out screen.
 * Displays either the "Start Shift" form or "End Shift" button based on
 * the current attendance state for the logged-in employee.
 *
 * Conditionally routes to AttendanceReceiptScreen on successful action.
 *
 * Skill compliance:
 *   hybrid-mobile-deployment §4 (Platform guards via useAttendanceSelfService hook)
 *   ui-design-system §14B (Touch targets ≥ 44px — enforced in CSS)
 *   development-best-practices §4 (Strict modularity — sub-components extracted)
 *   safe-code-modification §2 (No inline styles)
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../services/core/supabaseClient';
import { useAttendanceSelfService } from '../../../hooks/useAttendanceSelfService';
import AttendanceReceiptScreen from './AttendanceReceiptScreen';

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
// ShiftTypeSelector — Day / Night toggle buttons
// ---------------------------------------------------------------------------
const ShiftTypeSelector = ({ value, onChange }) => (
  <div className="form-group self-service__shift-group">
    <label className="form-label">SHIFT TYPE</label>
    <div className="self-service__shift-toggle">
      <button
        type="button"
        className={`self-service__shift-btn ${value === 'day' ? 'active' : ''}`}
        onClick={() => onChange('day')}
        id="shift-type-day"
      >
        ☀ Day
      </button>
      <button
        type="button"
        className={`self-service__shift-btn ${value === 'night' ? 'active' : ''}`}
        onClick={() => onChange('night')}
        id="shift-type-night"
      >
        🌙 Night
      </button>
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
// AttendanceSelfService — main export
// ---------------------------------------------------------------------------
const AttendanceSelfService = ({ user }) => {
  const {
    todayRecord,
    hasActiveSession,
    successData,
    isLoading,
    isActing,
    error,
    selectedShiftType, setSelectedShiftType,
    selectedHubId, setSelectedHubId,
    handleCheckIn,
    handleCheckOut,
    clearSuccessData,
  } = useAttendanceSelfService();

  // ---------------------------------------------------------------------------
  // Receipt screen routing: show receipt after successful check-in/out
  // ---------------------------------------------------------------------------
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

  const todayDisplay = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="self-service__container">
      {/* Page Header */}
      <div className="self-service__header">
        <h1 className="self-service__title">Attendance</h1>
        <p className="self-service__date">{todayDisplay}</p>
      </div>

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
          <ShiftTypeSelector
            value={selectedShiftType}
            onChange={setSelectedShiftType}
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
    </div>
  );
};

export default AttendanceSelfService;
```

---

## Validation Checklist

- [ ] File created in `src/verticals/Employees/attendance/`
- [ ] `useAttendanceSelfService` hook imported (not inline Supabase calls)
- [ ] `HubSelector` and `ShiftTypeSelector` are separate sub-components
- [ ] `HubSelector` fetches hubs via a local `useEffect` (not polluting the parent hook)
- [ ] `hasActiveSession` correctly gates between "Start Shift" form and "End Shift" button
- [ ] On `successData !== null`, renders `AttendanceReceiptScreen` (not navigates away)
- [ ] Form has `onSubmit` handler (not just `onClick` on the button — for Enter key support)
- [ ] `disabled={isActing || !selectedHubId}` on the Start Shift button
- [ ] `isLoading` state renders a spinner, not a crash
- [ ] NO inline styles

---

## DO NOT Proceed to Phase 4.2 Until All Items Above Are Checked.
