# Runbook 07 — Hub Reports: Verification Form

**Series:** Hub Daily Shift Reports · Phase 7 of 8  
**Board Key:** `hub_reports`  
**Vertical:** Data Manager  
**Author:** PowerProject Runbook System  
**Date:** 2026-07-30  

---

## Objective

Implement `VerificationForm.jsx` — the **checker's independent verification form**. Data team members use this to enter their own independently-measured values for each client's charging sessions and parked vehicles. The **Draft values (submitted by the maker) are displayed read-only on the LEFT** for reference. The **Verified input columns on the RIGHT start completely blank** — checkers must enter all values from scratch with no pre-fill from draft data. This enforces the maker-checker independence principle.

---

## Prerequisites

| # | Requirement | Source |
|---|-------------|--------|
| 1 | Runbooks 01–06 completed | `01_DATABASE_SCHEMA.md` – `06_ENTRY_FORM.md` |
| 2 | `hubReportService.verifyReport(reportId, payload)` exists and sets status to `'Verified'` | `03_SERVICE_LAYER.md` |
| 3 | The `report` object passed in contains `entries[]` with both `draft_*` and a populated `submitted_by` / `submitted_at` | `03_SERVICE_LAYER.md` |
| 4 | `HubReports.css` shared tokens file created | `05_COMPLIANCE_TRACKER.md` |
| 5 | `canVerifyHubReports` permission guard enforced by the caller (`HubReportsBoard`) before rendering this component | `02_RBAC.md` |

---

## Files Affected

| Action | File Path |
|--------|-----------|
| **CREATE** | `src/verticals/DataManager/components/HubReports/VerificationForm.jsx` |
| **CREATE** | `src/verticals/DataManager/components/HubReports/VerificationForm.css` |
| **IMPORT FROM** | `src/services/hubReportService.js` |
| **IMPORT FROM** | `./HubReports.css` (shared tokens) |

---

## UI Specification

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [← Back]   KIA Hub — Day Shift — 30 Jul 2026       [Draft by: John, 9:23am]│
│                                                                              │
│               ── DRAFT (read-only) ──      ── VERIFIED (enter values) ──    │
│  Client Name  S3W   S4W   P3W   P4W     │  S3W    S4W    P3W    P4W        │
│  ────────────────────────────────────────────────────────────────────────   │
│  TOTALS       37     0    26     0       │ [auto]  [auto] [auto] [auto]      │
│  ────────────────────────────────────────────────────────────────────────   │
│  BluRabbit     5     0     0     0       │ [   ]   [   ]  [   ]  [   ]       │
│  DFC           1     0     0     0       │ [   ]   [   ]  [   ]  [   ]       │
│  ...all clients in the report...                                             │
│                                                                              │
│  Checker Note (optional): [_________________________________]                │
│                                                                              │
│          [Cancel]                            [Verify & Submit]               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Critical Design Decisions

> ⚠️ **VERIFIED COLUMNS START BLANK — NO PRE-FILL FROM DRAFT**
>
> This is a deliberate product decision to enforce maker-checker independence.  
> The checker must enter their own independently-measured values.  
> Copying draft values into the verified inputs (even as a convenience) would undermine the integrity of the dual-entry system.  
> This rule must **not** be changed without explicit product approval.

### Column Group Definitions

| Group | Columns | Appearance |
|-------|---------|------------|
| **Draft** (left) | `draft_sessions_3w`, `draft_sessions_4w`, `draft_parked_3w`, `draft_parked_4w` | Grey text, read-only cells, subtle background |
| **Verified** (right) | `verified_sessions_3w`, `verified_sessions_4w`, `verified_parked_3w`, `verified_parked_4w` | White inputs, start empty |

### Header Attribution Badge

The header shows who submitted the draft and when:
```
[Draft by: John Doe, 30 Jul 2026 9:23 AM]
```
Source: `report.submitted_by_name` + `report.submitted_at`.

---

## Data Payload Schema

When verifying, the service receives:

```js
{
  checker_note: string,
  entries: [
    {
      client_id: string,
      verified_sessions_3w: number,
      verified_sessions_4w: number,
      verified_parked_3w:   number,
      verified_parked_4w:   number,
    },
    // ...one per client in the report
  ]
}
```

The service sets `status = 'Verified'`, `verified_by`, and `verified_at` server-side.

---

## Step-by-Step Implementation

### Step 1 — Create `VerificationForm.css`

```css
/* src/verticals/DataManager/components/HubReports/VerificationForm.css */
/* ─────────────────────────────────────────────────────────────────
   VerificationForm — Checker's dual-panel verification form
   ───────────────────────────────────────────────────────────────── */

/* ── Page header ────────────────────────────────────────────────── */
.verify-form__page-header {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-4, 1rem) var(--space-5, 1.25rem);
  border-bottom: 1px solid var(--border-subtle);
  flex-wrap: wrap;
}

.verify-form__back-icon {
  /* Inherits .halo-button */
  font-size: var(--text-base, 1rem);
  flex-shrink: 0;
}

.verify-form__title {
  font-size: var(--text-lg, 1.125rem);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Draft attribution badge ────────────────────────────────────── */
.verify-form__attribution {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
  background-color: color-mix(in srgb, var(--status-warning) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--status-warning) 25%, transparent);
  border-radius: var(--radius-full, 9999px);
  font-size: var(--text-xs, 0.75rem);
  color: var(--status-warning);
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Error banner ───────────────────────────────────────────────── */
.verify-form__error {
  margin: 0 var(--space-5, 1.25rem) var(--space-4, 1rem);
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  background-color: color-mix(in srgb, var(--status-danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--status-danger) 30%, transparent);
  border-radius: var(--radius-md);
  color: var(--status-danger);
  font-size: var(--text-sm, 0.875rem);
}

/* ── Table wrapper ──────────────────────────────────────────────── */
.verify-form__table-wrapper {
  overflow-x: auto;
  padding: var(--space-4, 1rem) var(--space-5, 1.25rem);
}

/* ── Dual-panel table ───────────────────────────────────────────── */
.verify-form__table {
  width: 100%;
  border-collapse: collapse;
  min-width: 860px;
}

/* Column group header row */
.verify-form__col-group-row th {
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  font-size: var(--text-xs, 0.75rem);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  border-bottom: 1px solid var(--border-subtle);
}

.verify-form__col-group-row th:first-child {
  /* Hub name column */
  background: transparent;
  color: var(--text-tertiary);
}

.verify-form__col-group-header--draft {
  background-color: var(--surface-subtle);
  color: var(--text-secondary);
  text-align: center;
  border-right: 2px solid var(--border-default);
}

.verify-form__col-group-header--verified {
  background-color: color-mix(in srgb, var(--status-success) 8%, transparent);
  color: var(--status-success);
  text-align: center;
}

/* Sub-header row (individual column labels) */
.verify-form__sub-header-row th {
  background-color: var(--surface-subtle);
  color: var(--text-secondary);
  font-size: var(--text-xs, 0.75rem);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  text-align: center;
  border-bottom: 2px solid var(--border-subtle);
  position: sticky;
  top: 0;
  z-index: 1;
}

.verify-form__sub-header-row th:first-child {
  text-align: left;
  width: 180px;
  min-width: 180px;
}

.verify-form__sub-header-row th.verify-form__col--draft {
  background-color: var(--surface-subtle);
  color: var(--text-tertiary);
}

.verify-form__sub-header-row th.verify-form__col--verified {
  background-color: color-mix(in srgb, var(--status-success) 6%, var(--surface-subtle));
  color: var(--status-success);
}

/* ── Divider between groups ─────────────────────────────────────── */
.verify-form__group-divider {
  border-right: 2px solid var(--border-default);
}

/* ── Totals row ─────────────────────────────────────────────────── */
.verify-form__row--totals {
  background-color: var(--surface-subtle);
  border-top: 2px solid var(--border-default);
  border-bottom: 2px solid var(--border-default);
}

.verify-form__row--totals td {
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  font-weight: 700;
  font-size: var(--text-sm, 0.875rem);
  text-align: center;
  color: var(--text-primary);
}

.verify-form__row--totals td:first-child {
  text-align: left;
  font-size: var(--text-xs, 0.75rem);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

/* ── Client rows ────────────────────────────────────────────────── */
.verify-form__row--client {
  border-bottom: 1px solid var(--border-subtle);
  transition: background-color 0.12s ease;
}

.verify-form__row--client:last-of-type {
  border-bottom: none;
}

.verify-form__row--client:hover {
  background-color: var(--surface-hover);
}

/* ── Read-only draft cells ──────────────────────────────────────── */
.verify-form__cell--name {
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-primary);
  font-weight: 500;
}

.verify-form__cell--draft-value {
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  text-align: center;
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary);
  background-color: var(--surface-subtle);
  font-variant-numeric: tabular-nums;
}

.verify-form__cell--draft-value.verify-form__group-divider {
  /* Last column in the draft group */
}

/* ── Verified input cells ───────────────────────────────────────── */
.verify-form__cell--input {
  padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
  text-align: center;
  background-color: color-mix(in srgb, var(--status-success) 3%, transparent);
}

/* ── Verified number input ──────────────────────────────────────── */
.verify-form__number-input {
  width: 76px;
  padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background-color: var(--surface-input, var(--surface-base));
  color: var(--text-primary);
  font-size: var(--text-sm, 0.875rem);
  text-align: center;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  -moz-appearance: textfield;
}

.verify-form__number-input::-webkit-outer-spin-button,
.verify-form__number-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.verify-form__number-input:focus {
  outline: none;
  border-color: var(--status-success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--status-success) 18%, transparent);
}

/* ── Totals: verified side ──────────────────────────────────────── */
.verify-form__totals-verified {
  font-weight: 700;
  color: var(--status-success);
  background-color: color-mix(in srgb, var(--status-success) 5%, transparent);
}

/* ── Checker note ───────────────────────────────────────────────── */
.verify-form__note-section {
  padding: var(--space-4, 1rem) var(--space-5, 1.25rem);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
}

.verify-form__note-label {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary);
  font-weight: 500;
}

.verify-form__note-input {
  width: 100%;
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background-color: var(--surface-input, var(--surface-base));
  color: var(--text-primary);
  font-size: var(--text-sm, 0.875rem);
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  box-sizing: border-box;
}

.verify-form__note-input:focus {
  outline: none;
  border-color: var(--status-success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--status-success) 18%, transparent);
}

/* ── Footer ─────────────────────────────────────────────────────── */
.verify-form__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-4, 1rem) var(--space-5, 1.25rem);
  border-top: 1px solid var(--border-subtle);
}

.verify-form__submit-btn--loading {
  opacity: 0.7;
  pointer-events: none;
  cursor: not-allowed;
}

/* ── Success state banner ───────────────────────────────────────── */
.verify-form__success {
  margin: var(--space-4, 1rem) var(--space-5, 1.25rem);
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  background-color: color-mix(in srgb, var(--status-success) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--status-success) 30%, transparent);
  border-radius: var(--radius-md);
  color: var(--status-success);
  font-size: var(--text-sm, 0.875rem);
  font-weight: 500;
}
```

---

### Step 2 — Create `VerificationForm.jsx`

```jsx
// src/verticals/DataManager/components/HubReports/VerificationForm.jsx
import React, { useState, useMemo, useCallback } from 'react';
import hubReportService from '../../../../services/hubReportService';
import './VerificationForm.css';
import './HubReports.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAFT_COLUMNS = [
  { key: 'draft_sessions_3w', label: 'S3W' },
  { key: 'draft_sessions_4w', label: 'S4W' },
  { key: 'draft_parked_3w',   label: 'P3W' },
  { key: 'draft_parked_4w',   label: 'P4W' },
];

const VERIFIED_COLUMNS = [
  { key: 'verified_sessions_3w', label: 'S3W' },
  { key: 'verified_sessions_4w', label: 'S4W' },
  { key: 'verified_parked_3w',   label: 'P3W' },
  { key: 'verified_parked_4w',   label: 'P4W' },
];

// ─── Helper: format date + time for attribution badge ────────────────────────

function formatDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function formatDateHuman(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Helper: build initial verified rows (ALL BLANK — critical) ───────────────

/**
 * IMPORTANT: verified inputs start completely EMPTY.
 * This is intentional and enforces maker-checker independence.
 * Do NOT pre-fill from draft values.
 */
function buildBlankVerifiedRows(entries) {
  const rows = {};
  entries.forEach(entry => {
    rows[entry.client_id] = {
      verified_sessions_3w: '',
      verified_sessions_4w: '',
      verified_parked_3w:   '',
      verified_parked_4w:   '',
    };
  });
  return rows;
}

// ─── Sub-component: DraftTotalsCell ──────────────────────────────────────────

function getDraftTotal(entries, key) {
  return entries.reduce((sum, e) => sum + (Number(e[key]) || 0), 0);
}

// ─── Sub-component: VerifiedTotals (memoized) ─────────────────────────────────

function VerifiedTotalCell({ rows, colKey }) {
  const total = useMemo(() => {
    return Object.values(rows).reduce((sum, row) => {
      const val = row[colKey];
      return sum + (val === '' ? 0 : Number(val) || 0);
    }, 0);
  }, [rows, colKey]);

  return <td className="verify-form__row--totals verify-form__totals-verified">{total}</td>;
}

// ─── Sub-component: ClientVerifyRow ──────────────────────────────────────────

function ClientVerifyRow({ entry, verifiedValues, onInputChange }) {
  return (
    <tr className="verify-form__row--client">
      {/* Client name */}
      <td className="verify-form__cell--name">{entry.client_name}</td>

      {/* Draft values — read-only */}
      {DRAFT_COLUMNS.map((col, idx) => (
        <td
          key={col.key}
          className={`verify-form__cell--draft-value${idx === DRAFT_COLUMNS.length - 1 ? ' verify-form__group-divider' : ''}`}
        >
          {entry[col.key] ?? 0}
        </td>
      ))}

      {/* Verified inputs — start blank */}
      {VERIFIED_COLUMNS.map(col => (
        <td key={col.key} className="verify-form__cell--input">
          <input
            className="verify-form__number-input"
            id={`verify-${entry.client_id}-${col.key}`}
            type="number"
            min="0"
            step="1"
            value={verifiedValues[col.key] ?? ''}
            placeholder="—"
            onChange={e => onInputChange(entry.client_id, col.key, e.target.value)}
            aria-label={`${entry.client_name} verified ${col.label}`}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * VerificationForm
 *
 * Checker's independent verification form. Displays the maker's draft
 * values read-only on the left. Verified inputs on the right start blank —
 * checkers must independently enter all values.
 *
 * @param {object}   report       - Full report object including entries[], submitted_by_name, submitted_at
 * @param {function} onBack       - Called to return to ComplianceTracker
 * @param {function} onVerified   - Called after successful verification
 */
const VerificationForm = ({ report, onBack, onVerified }) => {
  const entries = report?.entries ?? [];

  // ── Verified input state: ALL start blank ─────────────────────
  // CRITICAL: Do NOT change buildBlankVerifiedRows to pre-fill from draft.
  const [verifiedRows, setVerifiedRows] = useState(() => buildBlankVerifiedRows(entries));
  const [checkerNote, setCheckerNote]   = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState(null);

  // ── Handle verified input change ─────────────────────────────
  const handleInputChange = useCallback((clientId, colKey, rawValue) => {
    // Allow empty string so the placeholder is visible until typed
    const coerced = rawValue === '' ? '' : Math.max(0, parseInt(rawValue, 10) || 0);
    setVerifiedRows(prev => ({
      ...prev,
      [clientId]: { ...prev[clientId], [colKey]: coerced },
    }));
  }, []);

  // ── Build verify payload ─────────────────────────────────────
  const buildPayload = useCallback(() => ({
    checker_note: checkerNote.trim(),
    entries: entries.map(entry => ({
      client_id:            entry.client_id,
      verified_sessions_3w: Number(verifiedRows[entry.client_id]?.verified_sessions_3w) || 0,
      verified_sessions_4w: Number(verifiedRows[entry.client_id]?.verified_sessions_4w) || 0,
      verified_parked_3w:   Number(verifiedRows[entry.client_id]?.verified_parked_3w)   || 0,
      verified_parked_4w:   Number(verifiedRows[entry.client_id]?.verified_parked_4w)   || 0,
    })),
  }), [checkerNote, entries, verifiedRows]);

  // ── Submit verification ──────────────────────────────────────
  const handleVerify = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildPayload();
      await hubReportService.verifyReport(report.id, payload);
      onVerified();
    } catch (err) {
      console.error('[VerificationForm] handleVerify error:', err);
      setError(err?.message ?? 'Verification failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Page title ───────────────────────────────────────────────
  const pageTitle = `${report?.hub_name ?? ''} — ${report?.shift ?? ''} Shift — ${formatDateHuman(report?.report_date)}`;
  const attributionText = report?.submitted_by_name
    ? `Draft by: ${report.submitted_by_name}, ${formatDateTime(report.submitted_at)}`
    : null;

  // ── Draft column totals (static — computed once) ──────────────
  const draftTotals = useMemo(() => (
    DRAFT_COLUMNS.reduce((acc, col) => {
      acc[col.key] = getDraftTotal(entries, col.key);
      return acc;
    }, {})
  ), [entries]);

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="hub-reports-board">
      <div className="hub-reports-card">

        {/* ── Page Header ─────────────────────────────────────── */}
        <div className="verify-form__page-header">
          <button
            className="halo-button verify-form__back-icon"
            onClick={onBack}
            type="button"
            aria-label="Back to tracker"
          >
            ← Back
          </button>
          <h1 className="verify-form__title">{pageTitle}</h1>
          {attributionText && (
            <span className="verify-form__attribution" title={`Submitted: ${attributionText}`}>
              📋 {attributionText}
            </span>
          )}
        </div>

        {/* ── Error banner ────────────────────────────────────── */}
        {error && (
          <div className="verify-form__error" role="alert">
            {error}
          </div>
        )}

        {/* ── Dual-panel table ────────────────────────────────── */}
        <div className="verify-form__table-wrapper">
          <table className="verify-form__table" aria-label="Hub shift verification form">
            <thead>
              {/* Column group labels */}
              <tr className="verify-form__col-group-row">
                <th scope="col" />
                <th
                  scope="colgroup"
                  colSpan={DRAFT_COLUMNS.length}
                  className="verify-form__col-group-header--draft verify-form__group-divider"
                >
                  ── DRAFT (read-only) ──
                </th>
                <th
                  scope="colgroup"
                  colSpan={VERIFIED_COLUMNS.length}
                  className="verify-form__col-group-header--verified"
                >
                  ── VERIFIED (enter values) ──
                </th>
              </tr>

              {/* Sub-column labels */}
              <tr className="verify-form__sub-header-row">
                <th scope="col">Client Name</th>
                {DRAFT_COLUMNS.map((col, idx) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`verify-form__col--draft${idx === DRAFT_COLUMNS.length - 1 ? ' verify-form__group-divider' : ''}`}
                  >
                    {col.label}
                  </th>
                ))}
                {VERIFIED_COLUMNS.map(col => (
                  <th key={col.key} scope="col" className="verify-form__col--verified">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* ── Totals row ──────────────────────────────────── */}
              <tr className="verify-form__row--totals">
                <td>Totals</td>
                {DRAFT_COLUMNS.map((col, idx) => (
                  <td
                    key={col.key}
                    className={idx === DRAFT_COLUMNS.length - 1 ? 'verify-form__group-divider' : ''}
                  >
                    {draftTotals[col.key]}
                  </td>
                ))}
                {VERIFIED_COLUMNS.map(col => (
                  <VerifiedTotalCell key={col.key} rows={verifiedRows} colKey={col.key} />
                ))}
              </tr>

              {/* ── Divider ─────────────────────────────────────── */}
              <tr aria-hidden="true">
                <td
                  colSpan={1 + DRAFT_COLUMNS.length + VERIFIED_COLUMNS.length}
                  style={{ height: '2px', background: 'var(--border-subtle)', padding: 0 }}
                />
              </tr>

              {/* ── Client rows ─────────────────────────────────── */}
              {entries.map(entry => (
                <ClientVerifyRow
                  key={entry.client_id}
                  entry={entry}
                  verifiedValues={verifiedRows[entry.client_id] ?? {}}
                  onInputChange={handleInputChange}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Checker note ────────────────────────────────────── */}
        <div className="verify-form__note-section">
          <label className="verify-form__note-label" htmlFor="checker-note">
            Checker Note (optional)
          </label>
          <textarea
            id="checker-note"
            className="verify-form__note-input"
            placeholder="Add any discrepancy notes or observations…"
            value={checkerNote}
            onChange={e => setCheckerNote(e.target.value)}
            rows={2}
          />
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <div className="verify-form__footer">
          <button
            className="halo-button"
            onClick={onBack}
            type="button"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className={`halo-button halo-button--primary${submitting ? ' verify-form__submit-btn--loading' : ''}`}
            onClick={handleVerify}
            type="button"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Verifying…' : '✔ Verify & Submit'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default VerificationForm;
```

---

## Behavior Notes

### Why Verified Inputs Start Blank

The maker-checker system's integrity rests on the checker independently verifying data. If verified inputs were pre-filled from draft values, a lazy checker could simply click "Verify & Submit" without actually measuring anything — defeating the entire purpose of dual-entry. The `buildBlankVerifiedRows` function explicitly initializes all verified column values to `''` (empty string, displayed as `placeholder="—"`).

### Verified Totals Auto-Computation

`VerifiedTotalCell` is a separate component that receives `rows` and `colKey`. It uses `useMemo` internally to sum its column. Empty inputs (`''`) count as 0. This gives the checker an accurate live total as they type, helping them spot column-level discrepancies against the draft totals.

### State After Submission

After `verifyReport()` resolves successfully, `onVerified()` is called. The caller (`HubReportsBoard`) should:
1. Navigate back to `ComplianceTracker`
2. Trigger a re-fetch of the matrix so the cell updates to 🟢 Verified

### `entries` Enrichment

The `report` object passed from the tracker must have `entries[].client_name` populated (join from clients table). If the service returns raw `client_id` only, the service layer must resolve names before passing the report to this component.

---

## Expected `report` Object Shape

```js
{
  id: 'rpt_abc123',
  hub_id: 'hub_kia',
  hub_name: 'KIA',
  report_date: '2026-07-30',
  shift: 'Day',
  status: 'Draft',
  submitted_by_name: 'John Doe',
  submitted_at: '2026-07-30T03:53:00.000Z',
  note: 'Operator note here',
  entries: [
    {
      client_id: 'client_bluerabbit',
      client_name: 'BluRabbit',
      draft_sessions_3w: 5,
      draft_sessions_4w: 0,
      draft_parked_3w:   0,
      draft_parked_4w:   0,
    },
    // ...more clients
  ]
}
```

---

## Validation Checklist

- [ ] **Verified inputs start empty** — no values pre-filled from draft columns (critical rule)
- [ ] **Draft values shown** — all draft column values displayed correctly (read-only)
- [ ] **Draft totals correct** — computed from `entries` on mount, static thereafter
- [ ] **Verified totals live-update** — as checker types, totals update in real time
- [ ] **Attribution badge** — shows submitter name and time; hidden if unavailable
- [ ] **Checker note saved** in payload
- [ ] **Error banner** on failed submission with `role="alert"`
- [ ] **Loading state** on submit button — `aria-busy` set, button disabled
- [ ] **`onVerified()` called** after successful service call
- [ ] **`onBack()` called** on Cancel
- [ ] **Horizontal scroll** — table scrolls horizontally on narrow viewports (min-width on table)
- [ ] **Column group headers** correctly span draft and verified column sets
- [ ] **No inline styles** (one `height: 2px` divider row is acceptable — extract in cleanup)
- [ ] **Component line count** — stays under 400 lines

---

## Next Step

→ Proceed to **Runbook 08: `08_ANALYTICS_DASHBOARD.md`** — Implements `AnalyticsDashboard.jsx`, the Recharts-powered analytics view with line charts, bar charts, and summary stat cards.
