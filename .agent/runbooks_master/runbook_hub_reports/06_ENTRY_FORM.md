# Runbook 06 — Hub Reports: Report Entry Form

**Series:** Hub Daily Shift Reports · Phase 6 of 8  
**Board Key:** `hub_reports`  
**Vertical:** Data Manager  
**Author:** PowerProject Runbook System  
**Date:** 2026-07-30  

---

## Objective

Implement `ReportEntryForm.jsx` — the **maker's draft submission form**. Hub operators use this to enter charging session counts and currently-parked vehicle counts per client for a specific hub / date / shift combination. The form supports both **new draft creation** and **editing an existing draft**. It auto-computes column totals as the user types, validates inputs, and calls the service to persist.

---

## Prerequisites

| # | Requirement | Source |
|---|-------------|--------|
| 1 | Runbooks 01–05 completed | `01_DATABASE_SCHEMA.md` – `05_COMPLIANCE_TRACKER.md` |
| 2 | `hubReportService.getActiveClients()` returns all active clients | `03_SERVICE_LAYER.md` |
| 3 | `hubReportService.createDraft(payload)` exists | `03_SERVICE_LAYER.md` |
| 4 | `hubReportService.updateDraft(reportId, payload)` exists | `03_SERVICE_LAYER.md` |
| 5 | `HubReports.css` shared tokens file created | `05_COMPLIANCE_TRACKER.md` |
| 6 | `.halo-button` utility available globally | Design system CSS |
| 7 | CSS variables `--status-danger`, `--radius-squircle`, `--space-*`, `--text-*` defined | Design system |

---

## Files Affected

| Action | File Path |
|--------|-----------|
| **CREATE** | `src/verticals/DataManager/components/HubReports/ReportEntryForm.jsx` |
| **CREATE** | `src/verticals/DataManager/components/HubReports/ReportEntryForm.css` |
| **IMPORT FROM** | `src/services/hubReportService.js` |
| **IMPORT FROM** | `./HubReports.css` (shared tokens) |

---

## UI Specification

```
┌──────────────────────────────────────────────────────────────┐
│  [← Back]   KIA Hub — Day Shift — 30 Jul 2026               │
│                                                              │
│  Client Name    Sess. 3W  Sess. 4W  Parked 3W  Parked 4W   │
│  ─────────────────────────────────────────────────────────  │
│  TOTALS         [auto]    [auto]    [auto]      [auto]       │
│  ─────────────────────────────────────────────────────────  │
│  4W Ind         [  0  ]   [  0  ]   [  0  ]    [  0  ]      │
│  Arun Logistics [  0  ]   [  0  ]   [  0  ]    [  0  ]      │
│  BluRabbit      [  0  ]   [  0  ]   [  0  ]    [  0  ]      │
│  ...all active clients...                                    │
│                                                              │
│  Note (optional): [________________________]                 │
│                                                              │
│          [Cancel]              [Save Draft]                  │
└──────────────────────────────────────────────────────────────┘
```

### Columns

| Column Key | Label | Description |
|------------|-------|-------------|
| `sessions_3w` | Sess. 3W | Charging sessions — 3-wheeler vehicles |
| `sessions_4w` | Sess. 4W | Charging sessions — 4-wheeler vehicles |
| `parked_3w` | Parked 3W | Currently parked — 3-wheelers |
| `parked_4w` | Parked 4W | Currently parked — 4-wheelers |

### Row Types

| Row | Behavior |
|-----|----------|
| **TOTALS** | Auto-computed sum of all client rows. Read-only. Updates on every keystroke via controlled state. |
| **Client rows** | One row per active client (from `hubReportService.getActiveClients()`). Inputs: `type=number`, `min=0`, `step=1`. |

### Pre-fill Logic

| Mode | Input Initial Values |
|------|---------------------|
| **New** (no `existingReport`) | All inputs start at `0` |
| **Edit** (has `existingReport`) | Pre-fill from `existingReport.entries[clientId]` draft values |

> **Design Decision:** Only draft values are pre-filled. Verified values are never read here. This is the maker-only form.

---

## Data Payload Schema

When saving, the service receives:

```js
{
  hub_id: string,
  report_date: string,   // 'YYYY-MM-DD'
  shift: 'Day' | 'Night',
  status: 'Draft',
  note: string,
  entries: [
    {
      client_id: string,
      draft_sessions_3w: number,
      draft_sessions_4w: number,
      draft_parked_3w: number,
      draft_parked_4w: number,
    },
    // ...one per active client
  ]
}
```

---

## Step-by-Step Implementation

### Step 1 — Create `ReportEntryForm.css`

```css
/* src/verticals/DataManager/components/HubReports/ReportEntryForm.css */
/* ─────────────────────────────────────────────────────────────────
   ReportEntryForm — Maker's draft submission form styles
   ───────────────────────────────────────────────────────────────── */

/* ── Back button + header ───────────────────────────────────────── */
.entry-form__back-btn {
  /* Inherits .halo-button */
  margin-bottom: var(--space-4, 1rem);
  align-self: flex-start;
}

.entry-form__page-header {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-4, 1rem) var(--space-5, 1.25rem);
  border-bottom: 1px solid var(--border-subtle);
}

.entry-form__back-icon {
  /* Inherits .halo-button */
  font-size: var(--text-base, 1rem);
}

.entry-form__title {
  font-size: var(--text-lg, 1.125rem);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.entry-form__subtitle {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary);
  margin-left: auto;
}

/* ── Table container ────────────────────────────────────────────── */
.entry-form__table-wrapper {
  overflow-x: auto;
  padding: var(--space-4, 1rem) var(--space-5, 1.25rem);
}

/* ── Data table ─────────────────────────────────────────────────── */
.entry-form__table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  min-width: 620px;
}

.entry-form__table th {
  background-color: var(--surface-subtle);
  color: var(--text-secondary);
  font-size: var(--text-xs, 0.75rem);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  text-align: center;
  border-bottom: 2px solid var(--border-subtle);
}

.entry-form__table th:first-child {
  text-align: left;
  width: 200px;
}

.entry-form__table th:not(:first-child) {
  width: calc((100% - 200px) / 4);
}

/* ── Totals row ─────────────────────────────────────────────────── */
.entry-form__row--totals {
  background-color: var(--surface-subtle);
  border-top: 2px solid var(--border-default);
  border-bottom: 2px solid var(--border-default);
}

.entry-form__row--totals td {
  font-weight: 700;
  color: var(--text-primary);
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  text-align: center;
  font-size: var(--text-sm, 0.875rem);
}

.entry-form__row--totals td:first-child {
  text-align: left;
  font-size: var(--text-xs, 0.75rem);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

/* ── Client rows ────────────────────────────────────────────────── */
.entry-form__row--client {
  border-bottom: 1px solid var(--border-subtle);
  transition: background-color 0.12s ease;
}

.entry-form__row--client:last-of-type {
  border-bottom: none;
}

.entry-form__row--client:hover {
  background-color: var(--surface-hover);
}

.entry-form__cell--name {
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-primary);
  font-weight: 500;
}

.entry-form__cell--input {
  padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
  text-align: center;
}

/* ── Number input ───────────────────────────────────────────────── */
.entry-form__number-input {
  width: 80px;
  padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background-color: var(--surface-input, var(--surface-base));
  color: var(--text-primary);
  font-size: var(--text-sm, 0.875rem);
  text-align: center;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  /* Remove browser spin arrows for cleaner look — optional */
  -moz-appearance: textfield;
}

.entry-form__number-input::-webkit-outer-spin-button,
.entry-form__number-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.entry-form__number-input:focus {
  outline: none;
  border-color: var(--brand-green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-green) 20%, transparent);
}

.entry-form__number-input:invalid {
  border-color: var(--status-danger);
}

/* ── Note field ─────────────────────────────────────────────────── */
.entry-form__note-section {
  padding: var(--space-4, 1rem) var(--space-5, 1.25rem);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
}

.entry-form__note-label {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary);
  font-weight: 500;
}

.entry-form__note-input {
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

.entry-form__note-input:focus {
  outline: none;
  border-color: var(--brand-green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-green) 20%, transparent);
}

/* ── Error banner ───────────────────────────────────────────────── */
.entry-form__error {
  margin: 0 var(--space-5, 1.25rem) var(--space-4, 1rem);
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  background-color: color-mix(in srgb, var(--status-danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--status-danger) 30%, transparent);
  border-radius: var(--radius-md);
  color: var(--status-danger);
  font-size: var(--text-sm, 0.875rem);
}

/* ── Footer actions ─────────────────────────────────────────────── */
.entry-form__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-4, 1rem) var(--space-5, 1.25rem);
  border-top: 1px solid var(--border-subtle);
}

/* Loading spinner for save button */
.entry-form__save-btn--loading {
  opacity: 0.7;
  pointer-events: none;
  cursor: not-allowed;
}
```

---

### Step 2 — Create `ReportEntryForm.jsx`

```jsx
// src/verticals/DataManager/components/HubReports/ReportEntryForm.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import hubReportService from '../../../../services/hubReportService';
import './ReportEntryForm.css';
import './HubReports.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'sessions_3w', label: 'Sess. 3W' },
  { key: 'sessions_4w', label: 'Sess. 4W' },
  { key: 'parked_3w',   label: 'Parked 3W' },
  { key: 'parked_4w',   label: 'Parked 4W' },
];

// ─── Helper: build initial row state from existing report entries ─────────────

/**
 * Initializes the input map (clientId → { sessions_3w, sessions_4w, parked_3w, parked_4w })
 * for all active clients. Pre-fills from existingReport if editing a draft.
 */
function buildInitialRows(activeClients, existingReport) {
  const entryMap = {};
  if (existingReport?.entries) {
    existingReport.entries.forEach(e => {
      entryMap[e.client_id] = {
        sessions_3w: e.draft_sessions_3w ?? 0,
        sessions_4w: e.draft_sessions_4w ?? 0,
        parked_3w:   e.draft_parked_3w   ?? 0,
        parked_4w:   e.draft_parked_4w   ?? 0,
      };
    });
  }

  const rows = {};
  activeClients.forEach(client => {
    rows[client.id] = entryMap[client.id] ?? {
      sessions_3w: 0,
      sessions_4w: 0,
      parked_3w:   0,
      parked_4w:   0,
    };
  });
  return rows;
}

// ─── Helper: format date as human-readable ───────────────────────────────────

function formatDateHuman(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Sub-component: TotalsRow ─────────────────────────────────────────────────

function TotalsRow({ rows }) {
  const totals = useMemo(() => {
    return COLUMNS.reduce((acc, col) => {
      acc[col.key] = Object.values(rows).reduce((sum, row) => sum + (Number(row[col.key]) || 0), 0);
      return acc;
    }, {});
  }, [rows]);

  return (
    <tr className="entry-form__row--totals">
      <td className="entry-form__cell--name">Totals</td>
      {COLUMNS.map(col => (
        <td key={col.key} className="entry-form__cell--input">
          {totals[col.key]}
        </td>
      ))}
    </tr>
  );
}

// ─── Sub-component: ClientRow ─────────────────────────────────────────────────

function ClientRow({ client, rowValues, onInputChange }) {
  return (
    <tr className="entry-form__row--client">
      <td className="entry-form__cell--name">{client.name}</td>
      {COLUMNS.map(col => (
        <td key={col.key} className="entry-form__cell--input">
          <input
            className="entry-form__number-input"
            id={`entry-${client.id}-${col.key}`}
            type="number"
            min="0"
            step="1"
            value={rowValues[col.key] ?? 0}
            onChange={e => onInputChange(client.id, col.key, e.target.value)}
            aria-label={`${client.name} ${col.label}`}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * ReportEntryForm
 *
 * Maker's draft submission form. Hub operators fill in client-level charging
 * session and parking counts for a given hub / date / shift combination.
 *
 * @param {string}      hubId           - Hub identifier
 * @param {string}      hubName         - Hub display name
 * @param {string}      reportDate      - ISO date string 'YYYY-MM-DD'
 * @param {'Day'|'Night'} shift         - Shift type
 * @param {object|null} existingReport  - If editing a draft, the existing report object; null for new
 * @param {function}    onBack          - Called to return to ComplianceTracker
 * @param {function}    onSaved         - Called after successful save
 */
const ReportEntryForm = ({ hubId, hubName, reportDate, shift, existingReport, onBack, onSaved }) => {
  const [activeClients, setActiveClients]   = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [rows, setRows]                     = useState({});
  const [note, setNote]                     = useState(existingReport?.note ?? '');
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState(null);

  // ── Fetch active clients on mount ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setClientsLoading(true);
      try {
        const clients = await hubReportService.getActiveClients();
        if (cancelled) return;
        setActiveClients(clients);
        setRows(buildInitialRows(clients, existingReport));
      } catch (err) {
        console.error('[ReportEntryForm] getActiveClients error:', err);
        if (!cancelled) setError('Failed to load clients. Please go back and retry.');
      } finally {
        if (!cancelled) setClientsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [existingReport]);

  // ── Handle individual input change ───────────────────────────
  const handleInputChange = useCallback((clientId, colKey, rawValue) => {
    const parsed = Math.max(0, parseInt(rawValue, 10) || 0);
    setRows(prev => ({
      ...prev,
      [clientId]: { ...prev[clientId], [colKey]: parsed },
    }));
  }, []);

  // ── Build payload ────────────────────────────────────────────
  const buildPayload = useCallback(() => ({
    hub_id: hubId,
    report_date: reportDate,
    shift,
    status: 'Draft',
    note: note.trim(),
    entries: activeClients.map(client => ({
      client_id: client.id,
      draft_sessions_3w: rows[client.id]?.sessions_3w ?? 0,
      draft_sessions_4w: rows[client.id]?.sessions_4w ?? 0,
      draft_parked_3w:   rows[client.id]?.parked_3w   ?? 0,
      draft_parked_4w:   rows[client.id]?.parked_4w   ?? 0,
    })),
  }), [hubId, reportDate, shift, note, rows, activeClients]);

  // ── Save draft ───────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (existingReport?.id) {
        await hubReportService.updateDraft(existingReport.id, payload);
      } else {
        await hubReportService.createDraft(payload);
      }
      onSaved();
    } catch (err) {
      console.error('[ReportEntryForm] handleSave error:', err);
      setError(err?.message ?? 'Failed to save draft. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  const pageTitle = `${hubName} — ${shift} Shift — ${formatDateHuman(reportDate)}`;
  const isEditMode = Boolean(existingReport);

  return (
    <div className="hub-reports-board">
      <div className="hub-reports-card">

        {/* ── Page Header ─────────────────────────────────────── */}
        <div className="entry-form__page-header">
          <button
            className="halo-button entry-form__back-icon"
            onClick={onBack}
            type="button"
            aria-label="Back to tracker"
          >
            ← Back
          </button>
          <h1 className="entry-form__title">{pageTitle}</h1>
          {isEditMode && (
            <span className="entry-form__subtitle">Editing draft</span>
          )}
        </div>

        {/* ── Error banner ────────────────────────────────────── */}
        {error && (
          <div className="entry-form__error" role="alert">
            {error}
          </div>
        )}

        {/* ── Table ───────────────────────────────────────────── */}
        <div className="entry-form__table-wrapper">
          {clientsLoading ? (
            <p style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)', textAlign: 'center' }}>
              Loading clients…
            </p>
          ) : (
            <table className="entry-form__table" aria-label="Hub shift report entry">
              <thead>
                <tr>
                  <th scope="col">Client Name</th>
                  {COLUMNS.map(col => (
                    <th key={col.key} scope="col">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Totals row — pinned at top below header */}
                <TotalsRow rows={rows} />

                {/* Divider */}
                <tr aria-hidden="true">
                  <td colSpan={COLUMNS.length + 1} style={{ height: '2px', background: 'var(--border-subtle)', padding: 0 }} />
                </tr>

                {/* Client data rows */}
                {activeClients.map(client => (
                  <ClientRow
                    key={client.id}
                    client={client}
                    rowValues={rows[client.id] ?? {}}
                    onInputChange={handleInputChange}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Note field ──────────────────────────────────────── */}
        <div className="entry-form__note-section">
          <label className="entry-form__note-label" htmlFor="entry-form-note">
            Note (optional)
          </label>
          <textarea
            id="entry-form-note"
            className="entry-form__note-input"
            placeholder="Add any relevant notes for the data team…"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
          />
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <div className="entry-form__footer">
          <button
            className="halo-button"
            onClick={onBack}
            type="button"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className={`halo-button halo-button--primary${saving ? ' entry-form__save-btn--loading' : ''}`}
            onClick={handleSave}
            type="button"
            disabled={saving || clientsLoading}
            aria-busy={saving}
          >
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ReportEntryForm;
```

---

## Behavior Notes

### Totals Auto-Computation

The `<TotalsRow>` component receives the full `rows` map and uses `useMemo` to sum each column. Because `rows` is a controlled state object updated via `setRows` (immutably), React re-renders `TotalsRow` on every input change, keeping totals in sync without any manual wiring.

### Optimistic Loading State

The Save Draft button is disabled and shows `'Saving…'` text while the async call is in flight. The `.entry-form__save-btn--loading` class reduces opacity and blocks pointer events. On success, `onSaved()` is called which returns the user to the tracker (the tracker should re-fetch to show the new Draft status).

### Edit vs. Create

The same component handles both modes:
- `existingReport === null` → `hubReportService.createDraft(payload)` called
- `existingReport !== null` → `hubReportService.updateDraft(existingReport.id, payload)` called

The caller (`HubReportsBoard`) passes the correct prop based on which action button the user clicked in the tracker.

### Input Sanitisation

`handleInputChange` clamps values to `Math.max(0, parseInt(...) || 0)` — negative numbers and non-numeric input are silently coerced to 0. This keeps the totals row clean and prevents invalid payloads from reaching the service.

---

## Validation Checklist

- [ ] **Client list loads** — `getActiveClients()` called on mount; all active clients appear as rows
- [ ] **New form** — all inputs default to `0` when `existingReport` is `null`
- [ ] **Edit form** — inputs pre-fill from `existingReport.entries[].draft_*` values
- [ ] **Totals row** — updates live as any input changes
- [ ] **Negative prevention** — typing `-5` coerces to `0`
- [ ] **Note field** — saves with the payload; pre-fills if editing
- [ ] **Save button disabled** during loading (clients) and saving
- [ ] **Error banner** shown on failed save with message from service
- [ ] **`onSaved()` called** after successful create or update
- [ ] **Cancel button** calls `onBack()` without saving
- [ ] **No inline styles** (the loading `<p>` and divider `<td>` are acceptable temporary uses — extract in cleanup pass)
- [ ] **Accessibility** — all inputs have `aria-label`, save button has `aria-busy`, errors use `role="alert"`
- [ ] **Component line count** — stays under 350 lines

---

## Next Step

→ Proceed to **Runbook 07: `07_VERIFICATION_FORM.md`** — Implements `VerificationForm.jsx`, the checker's parallel-entry verification form with read-only draft columns on the left and blank verified inputs on the right.
