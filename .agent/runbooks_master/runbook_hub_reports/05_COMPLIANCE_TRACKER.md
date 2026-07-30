# Runbook 05 — Hub Reports: Compliance Tracker

**Series:** Hub Daily Shift Reports · Phase 5 of 8  
**Board Key:** `hub_reports`  
**Vertical:** Data Manager  
**Author:** PowerProject Runbook System  
**Date:** 2026-07-30  

---

## Objective

Implement `ComplianceTracker.jsx` — the **main landing view** of the Hub Reports board. This component renders a matrix table showing every configured hub on the vertical axis and Day/Night shifts on the horizontal axis for a selected date. Each cell displays the report status (Missing / Draft / Verified) and a context-sensitive action button. This is a **desktop-only**, read-and-dispatch view; it does not itself mutate data.

---

## Prerequisites

| # | Requirement | Source |
|---|-------------|--------|
| 1 | Runbook 01–04 completed (DB schema, RBAC, service, board registration) | `01_DATABASE_SCHEMA.md` – `04_BOARD_REGISTRATION.md` |
| 2 | `hubReportService.getComplianceMatrix(date)` exists and returns the shape defined in Runbook 03 | `03_SERVICE_LAYER.md` |
| 3 | RBAC permissions `canSubmitHubReports`, `canVerifyHubReports` available in auth context | `02_RBAC.md` |
| 4 | CSS variables `--status-danger`, `--status-warning`, `--status-success`, `--radius-squircle`, `--brand-green` defined in global token sheet | `index.css` / design system |
| 5 | `.halo-button` utility class available globally | Design system CSS |
| 6 | `HubReports.css` (shared) created in the same directory (see §8) | This runbook |

---

## Files Affected

| Action | File Path |
|--------|-----------|
| **CREATE** | `src/verticals/DataManager/components/HubReports/ComplianceTracker.jsx` |
| **CREATE** | `src/verticals/DataManager/components/HubReports/ComplianceTracker.css` |
| **CREATE** | `src/verticals/DataManager/components/HubReports/HubReports.css` |
| **IMPORT FROM** | `src/services/hubReportService.js` |
| **IMPORT FROM** | `src/contexts/AuthContext` (or equivalent permissions hook) |

---

## UI Specification

```
┌─────────────────────────────────────────────────────────────────────┐
│  Hub Reports                    Today: 30-Jul-2026 [← →] [📅 Pick] │
│  8/12 hubs submitted  •  5/12 verified                              │
├──────────────┬───────────────────────────┬──────────────────────────┤
│  Hub         │  Day Shift                │  Night Shift             │
│              │  [Status] [Action]        │  [Status] [Action]       │
├──────────────┼───────────────────────────┼──────────────────────────┤
│  ECT         │  🟢 Verified [View]       │  🔴 Missing [Submit]    │
│  HOODI       │  🟡 Draft    [Review]     │  🔴 Missing [Submit]    │
│  KB          │  🟢 Verified [View]       │  🟢 Verified [View]     │
│  KIA         │  🟢 Verified [View]       │  🟡 Draft    [Review]   │
│  TSR         │  🔴 Missing  [Submit]     │  🔴 Missing [Submit]    │
│  YPR         │  🟢 Verified [View]       │  🔴 Missing [Submit]    │
└──────────────┴───────────────────────────┴──────────────────────────┘
```

### Interaction Rules

| Button | Visible to | Status Condition | Action |
|--------|-----------|-----------------|--------|
| `[Submit]` | `canSubmitHubReports` only | `Missing` | Opens `ReportEntryForm` (new draft) |
| `[Review]` | `canVerifyHubReports` only | `Draft` | Opens `VerificationForm` |
| `[Edit Draft]` | `canSubmitHubReports` only | `Draft` | Opens `ReportEntryForm` (edit mode) |
| `[View]` | All roles | `Verified` | Opens read-only report view |

> **Note:** A user with both `canSubmitHubReports` and `canVerifyHubReports` sees **both** relevant buttons on Draft rows (Edit + Review side-by-side).

### Status Badge Color Map

| Status | CSS Modifier Class | CSS Variable |
|--------|-------------------|--------------|
| `Missing` | `.tracker-status-badge--missing` | `var(--status-danger)` |
| `Draft` | `.tracker-status-badge--draft` | `var(--status-warning)` |
| `Verified` | `.tracker-status-badge--verified` | `var(--status-success)` |

---

## Step-by-Step Implementation

### Step 1 — Create `HubReports.css` (Shared tokens file)

This file is imported by all sub-components in the `HubReports/` folder.

```css
/* src/verticals/DataManager/components/HubReports/HubReports.css */
/* ─────────────────────────────────────────────────────────────────
   Hub Reports — Shared layout tokens
   All sub-components import this file. Do NOT put component-specific
   styles here — those belong in their own .css files.
   ───────────────────────────────────────────────────────────────── */

.hub-reports-board {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--space-6, 1.5rem);
  gap: var(--space-5, 1.25rem);
  background-color: var(--surface-base);
  overflow-y: auto;
}

/* Shared section card wrapper used by all views */
.hub-reports-card {
  background-color: var(--surface-raised);
  border-radius: var(--radius-squircle);
  border: 1px solid var(--border-subtle);
  overflow: hidden;
}
```

---

### Step 2 — Create `ComplianceTracker.css`

```css
/* src/verticals/DataManager/components/HubReports/ComplianceTracker.css */
/* ─────────────────────────────────────────────────────────────────
   ComplianceTracker — Matrix view styles
   ───────────────────────────────────────────────────────────────── */

/* ── Header bar ─────────────────────────────────────────────────── */
.tracker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4, 1rem) var(--space-5, 1.25rem);
  border-bottom: 1px solid var(--border-subtle);
}

.tracker-header__title {
  font-size: var(--text-xl, 1.25rem);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

/* ── Date navigation ────────────────────────────────────────────── */
.tracker-date-nav {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
}

.tracker-date-nav__label {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary);
  min-width: 120px;
  text-align: center;
}

.tracker-date-nav__arrow {
  /* Inherits .halo-button — no additional overrides needed */
  padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
}

.tracker-date-nav__picker {
  /* Native date input — styled to match .halo-button aesthetics */
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
  font-size: var(--text-sm, 0.875rem);
  cursor: pointer;
}

.tracker-date-nav__picker::-webkit-calendar-picker-indicator {
  filter: invert(var(--icon-invert, 0));
  cursor: pointer;
}

/* ── Summary bar ────────────────────────────────────────────────── */
.tracker-summary-bar {
  display: flex;
  align-items: center;
  gap: var(--space-4, 1rem);
  padding: var(--space-3, 0.75rem) var(--space-5, 1.25rem);
  background-color: var(--surface-subtle);
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary);
}

.tracker-summary-bar__dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: var(--text-tertiary);
  flex-shrink: 0;
}

.tracker-summary-bar__stat {
  display: flex;
  align-items: center;
  gap: var(--space-1, 0.25rem);
}

.tracker-summary-bar__count {
  font-weight: 600;
  color: var(--text-primary);
}

/* ── Compliance table ───────────────────────────────────────────── */
.tracker-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.tracker-table th {
  background-color: var(--surface-subtle);
  color: var(--text-secondary);
  font-size: var(--text-xs, 0.75rem);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  text-align: left;
  border-bottom: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  z-index: 1;
}

.tracker-table th:first-child {
  width: 160px;
}

.tracker-table th:not(:first-child) {
  width: calc(50% - 80px);
}

.tracker-hub-row {
  border-bottom: 1px solid var(--border-subtle);
  transition: background-color 0.15s ease;
}

.tracker-hub-row:last-child {
  border-bottom: none;
}

.tracker-hub-row:hover {
  background-color: var(--surface-hover);
}

.tracker-cell {
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  vertical-align: middle;
}

.tracker-cell--hub-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: var(--text-sm, 0.875rem);
}

.tracker-cell--shift {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
}

/* ── Status badge ───────────────────────────────────────────────── */
.tracker-status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 0.25rem);
  padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
  border-radius: var(--radius-full, 9999px);
  font-size: var(--text-xs, 0.75rem);
  font-weight: 600;
  white-space: nowrap;
  min-width: 90px;
  justify-content: center;
}

.tracker-status-badge--missing {
  background-color: color-mix(in srgb, var(--status-danger) 12%, transparent);
  color: var(--status-danger);
  border: 1px solid color-mix(in srgb, var(--status-danger) 25%, transparent);
}

.tracker-status-badge--draft {
  background-color: color-mix(in srgb, var(--status-warning) 12%, transparent);
  color: var(--status-warning);
  border: 1px solid color-mix(in srgb, var(--status-warning) 25%, transparent);
}

.tracker-status-badge--verified {
  background-color: color-mix(in srgb, var(--status-success) 12%, transparent);
  color: var(--status-success);
  border: 1px solid color-mix(in srgb, var(--status-success) 25%, transparent);
}

/* ── Action buttons in cells ────────────────────────────────────── */
.tracker-action-btn {
  /* Inherits .halo-button — additional sizing overrides */
  font-size: var(--text-xs, 0.75rem);
  padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
}

.tracker-action-btn--submit {
  /* Accent variant — pulls from .halo-button base */
  border-color: var(--status-danger);
  color: var(--status-danger);
}

.tracker-action-btn--review {
  border-color: var(--status-warning);
  color: var(--status-warning);
}

.tracker-action-btn--view {
  border-color: var(--border-default);
  color: var(--text-secondary);
}

/* ── Loading skeleton ───────────────────────────────────────────── */
.tracker-skeleton-row {
  display: flex;
  align-items: center;
  gap: var(--space-4, 1rem);
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  border-bottom: 1px solid var(--border-subtle);
}

.tracker-skeleton-cell {
  height: 20px;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--surface-subtle) 25%,
    var(--surface-hover) 50%,
    var(--surface-subtle) 75%
  );
  background-size: 200% 100%;
  animation: tracker-shimmer 1.4s infinite;
}

.tracker-skeleton-cell--hub {
  width: 100px;
}

.tracker-skeleton-cell--shift {
  flex: 1;
}

@keyframes tracker-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Empty state ────────────────────────────────────────────────── */
.tracker-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-10, 2.5rem);
  color: var(--text-tertiary);
  gap: var(--space-3, 0.75rem);
}

.tracker-empty-state__icon {
  font-size: 2.5rem;
  opacity: 0.4;
}

.tracker-empty-state__text {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary);
}
```

---

### Step 3 — Create `ComplianceTracker.jsx`

> **Line-count discipline:** This component is intentionally kept under 350 lines. Helper sub-components (`TrackerCell`, `StatusBadge`, `SkeletonRows`) are defined in the same file for locality but can be extracted if the component grows beyond 400 lines.

```jsx
// src/verticals/DataManager/components/HubReports/ComplianceTracker.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import hubReportService from '../../../../services/hubReportService';
import './ComplianceTracker.css';
import './HubReports.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFTS = ['Day', 'Night'];

const STATUS_LABEL = {
  missing: 'Missing',
  draft: 'Draft',
  verified: 'Verified',
};

const STATUS_ICON = {
  missing: '🔴',
  draft: '🟡',
  verified: '🟢',
};

// ─── Helper: format date as "30-Jul-2026" ─────────────────────────────────────

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).replace(/ /g, '-');
}

// ─── Helper: ISO date string (YYYY-MM-DD) manipulation ───────────────────────

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Sub-component: StatusBadge ───────────────────────────────────────────────

function StatusBadge({ status }) {
  const modifier = status?.toLowerCase() || 'missing';
  return (
    <span className={`tracker-status-badge tracker-status-badge--${modifier}`}>
      {STATUS_ICON[modifier]} {STATUS_LABEL[modifier]}
    </span>
  );
}

// ─── Sub-component: TrackerCell ───────────────────────────────────────────────
// Renders status badge + context-sensitive action button(s) for one shift cell.

function TrackerCell({ cellData, permissions, onOpenEntry, onOpenVerify, onOpenView }) {
  const { hubId, hubName, reportDate, shift, status, report } = cellData;
  const s = status?.toLowerCase() || 'missing';

  const handleSubmit = () => onOpenEntry({ hubId, hubName, reportDate, shift, existingReport: null });
  const handleEditDraft = () => onOpenEntry({ hubId, hubName, reportDate, shift, existingReport: report });
  const handleReview = () => onOpenVerify({ report });
  const handleView = () => onOpenView({ report });

  return (
    <td className="tracker-cell">
      <div className="tracker-cell--shift">
        <StatusBadge status={s} />

        {/* Missing → Submit (makers only) */}
        {s === 'missing' && permissions.canSubmitHubReports && (
          <button
            className="halo-button tracker-action-btn tracker-action-btn--submit"
            onClick={handleSubmit}
            type="button"
          >
            Submit
          </button>
        )}

        {/* Draft → Edit (makers) and/or Review (checkers) */}
        {s === 'draft' && permissions.canSubmitHubReports && (
          <button
            className="halo-button tracker-action-btn tracker-action-btn--review"
            onClick={handleEditDraft}
            type="button"
          >
            Edit Draft
          </button>
        )}
        {s === 'draft' && permissions.canVerifyHubReports && (
          <button
            className="halo-button tracker-action-btn tracker-action-btn--review"
            onClick={handleReview}
            type="button"
          >
            Review
          </button>
        )}

        {/* Verified → View (all) */}
        {s === 'verified' && (
          <button
            className="halo-button tracker-action-btn tracker-action-btn--view"
            onClick={handleView}
            type="button"
          >
            View
          </button>
        )}
      </div>
    </td>
  );
}

// ─── Sub-component: SkeletonRows ──────────────────────────────────────────────

function SkeletonRows({ count = 6 }) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={`skel-${i}`} className="tracker-skeleton-row" style={{ display: 'table-row' }}>
      <td className="tracker-cell">
        <div className="tracker-skeleton-cell tracker-skeleton-cell--hub" />
      </td>
      <td className="tracker-cell">
        <div className="tracker-skeleton-cell tracker-skeleton-cell--shift" />
      </td>
      <td className="tracker-cell">
        <div className="tracker-skeleton-cell tracker-skeleton-cell--shift" />
      </td>
    </tr>
  ));
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * ComplianceTracker
 *
 * Main landing view for Hub Reports. Displays a matrix of hubs × shifts
 * for a selected date with status badges and context-sensitive action buttons.
 *
 * @param {object}   permissions   - { canSubmitHubReports, canVerifyHubReports }
 * @param {function} onOpenEntry   - Called with { hubId, hubName, reportDate, shift, existingReport }
 * @param {function} onOpenVerify  - Called with { report }
 * @param {function} onOpenView    - Called with { report }
 */
const ComplianceTracker = ({ permissions, onOpenEntry, onOpenVerify, onOpenView }) => {
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [matrix, setMatrix] = useState([]);   // Array<{ hubId, hubName, day: cellData, night: cellData }>
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Fetch matrix data ──────────────────────────────────────────
  const fetchMatrix = useCallback(async (date) => {
    setLoading(true);
    setError(null);
    try {
      const data = await hubReportService.getComplianceMatrix(date);
      setMatrix(data);
    } catch (err) {
      console.error('[ComplianceTracker] fetchMatrix error:', err);
      setError('Failed to load hub report data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatrix(selectedDate);
  }, [selectedDate, fetchMatrix]);

  // ── Summary stats (derived) ────────────────────────────────────
  const { totalHubs, submittedCount, verifiedCount } = useMemo(() => {
    const cells = matrix.flatMap(row => [row.day, row.night]);
    return {
      totalHubs: matrix.length,
      submittedCount: cells.filter(c => c?.status === 'draft' || c?.status === 'verified').length,
      verifiedCount: cells.filter(c => c?.status === 'verified').length,
    };
  }, [matrix]);

  const totalCells = totalHubs * 2; // day + night

  // ── Date navigation handlers ───────────────────────────────────
  const handlePrevDay = () => setSelectedDate(prev => shiftDate(prev, -1));
  const handleNextDay = () => setSelectedDate(prev => shiftDate(prev, 1));
  const handleDatePick = (e) => setSelectedDate(e.target.value);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="hub-reports-board">
      <div className="hub-reports-card">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="tracker-header">
          <h1 className="tracker-header__title">Hub Reports</h1>

          <div className="tracker-date-nav">
            <span className="tracker-date-nav__label">
              {formatDateLabel(selectedDate)}
            </span>
            <button
              className="halo-button tracker-date-nav__arrow"
              onClick={handlePrevDay}
              type="button"
              aria-label="Previous day"
            >
              ←
            </button>
            <button
              className="halo-button tracker-date-nav__arrow"
              onClick={handleNextDay}
              type="button"
              aria-label="Next day"
            >
              →
            </button>
            <input
              className="tracker-date-nav__picker"
              type="date"
              value={selectedDate}
              onChange={handleDatePick}
              aria-label="Jump to date"
            />
          </div>
        </div>

        {/* ── Summary bar ────────────────────────────────────────── */}
        <div className="tracker-summary-bar">
          <div className="tracker-summary-bar__stat">
            <span className="tracker-summary-bar__count">{submittedCount}/{totalCells}</span>
            <span>shifts submitted</span>
          </div>
          <div className="tracker-summary-bar__dot" aria-hidden="true" />
          <div className="tracker-summary-bar__stat">
            <span className="tracker-summary-bar__count">{verifiedCount}/{totalCells}</span>
            <span>verified</span>
          </div>
          {error && (
            <span style={{ marginLeft: 'auto', color: 'var(--status-danger)', fontSize: 'var(--text-xs)' }}>
              {error}
            </span>
          )}
        </div>

        {/* ── Matrix table ───────────────────────────────────────── */}
        <table className="tracker-table" aria-label="Hub shift compliance matrix">
          <thead>
            <tr>
              <th scope="col">Hub</th>
              <th scope="col">Day Shift</th>
              <th scope="col">Night Shift</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows count={6} />
            ) : matrix.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <div className="tracker-empty-state">
                    <span className="tracker-empty-state__icon">🏢</span>
                    <span className="tracker-empty-state__text">No hubs configured</span>
                  </div>
                </td>
              </tr>
            ) : (
              matrix.map((row) => (
                <tr key={row.hubId} className="tracker-hub-row">
                  <td className="tracker-cell tracker-cell--hub-name">
                    {row.hubName}
                  </td>
                  <TrackerCell
                    cellData={{ ...row.day, hubId: row.hubId, hubName: row.hubName, reportDate: selectedDate, shift: 'Day' }}
                    permissions={permissions}
                    onOpenEntry={onOpenEntry}
                    onOpenVerify={onOpenVerify}
                    onOpenView={onOpenView}
                  />
                  <TrackerCell
                    cellData={{ ...row.night, hubId: row.hubId, hubName: row.hubName, reportDate: selectedDate, shift: 'Night' }}
                    permissions={permissions}
                    onOpenEntry={onOpenEntry}
                    onOpenVerify={onOpenVerify}
                    onOpenView={onOpenView}
                  />
                </tr>
              ))
            )}
          </tbody>
        </table>

      </div>
    </div>
  );
};

export default ComplianceTracker;
```

---

## Expected Data Shape from `hubReportService.getComplianceMatrix(date)`

```js
// Return type: Array of hub rows
[
  {
    hubId: 'hub_ect',
    hubName: 'ECT',
    day: {
      status: 'verified',   // 'missing' | 'draft' | 'verified'
      report: { id, hub_id, report_date, shift, status, submitted_by, submitted_at, ... } | null
    },
    night: {
      status: 'missing',
      report: null
    }
  },
  // ...more hubs
]
```

---

## Validation Checklist

- [ ] **Date navigation** — prev/next arrows change date, data re-fetches correctly
- [ ] **Date picker** — jumping to an arbitrary date works
- [ ] **Loading state** — shimmer skeleton appears while fetch is in flight
- [ ] **Empty state** — "No hubs configured" shown when matrix returns `[]`
- [ ] **Error state** — error message shown in summary bar if fetch throws
- [ ] **Submit button** — only visible when `canSubmitHubReports === true` AND status is `missing`
- [ ] **Review button** — only visible when `canVerifyHubReports === true` AND status is `draft`
- [ ] **Edit Draft button** — only visible when `canSubmitHubReports === true` AND status is `draft`
- [ ] **View button** — visible to all roles when status is `verified`
- [ ] **Summary bar** — counts update correctly as matrix data changes
- [ ] **Status badge colors** — danger/warning/success CSS variables applied (no hardcoded hex)
- [ ] **No inline styles** (except the one emergency `style` on the error span — extract to class in cleanup pass)
- [ ] **Row hover** — subtle background change on row hover
- [ ] **Accessibility** — `<table>` has `aria-label`, `<th>` elements have `scope="col"`
- [ ] **Component line count** — stays under 400 lines

---

## Next Step

→ Proceed to **Runbook 06: `06_ENTRY_FORM.md`** — Implements `ReportEntryForm.jsx`, the maker's draft submission form.
