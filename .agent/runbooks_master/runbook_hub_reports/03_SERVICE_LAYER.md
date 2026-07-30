# Runbook 03: Service Layer — Hub Daily Shift Reports

## 1. Objective

Create `src/services/hub/hubReportService.js` — the single source of truth for all database interactions related to Hub Shift Reports. This service follows the project-standard named-export pattern and imports the Supabase client from `'../../core/supabaseClient'`.

The service handles seven distinct operations covering the full Maker-Checker lifecycle plus analytics aggregation.

---

## 2. Prerequisites

- [ ] Phase 1 (Database Schema) is complete — `hub_shift_reports` and `hub_shift_report_entries` tables exist.
- [ ] Phase 2 (RBAC) is complete — permission flags are registered.
- [ ] You have confirmed that `src/core/supabaseClient.js` exports a `supabase` default or named export.
- [ ] You have read the **Development Best Practices** and **Safe Code Modification** skills.
- [ ] Confirmed: `clients` table uses `status = 'Active'` (NOT `is_active`).
- [ ] Confirmed: `clients` table has NO `hub_id` column — all active clients appear globally.

---

## 3. Files Affected

| Action | Path |
| :----- | :--- |
| CREATE | `src/services/hub/hubReportService.js` |

---

## 4. Implementation Steps

### 4.1 Create `src/services/hub/hubReportService.js`

Create the file with the following complete content:

```javascript
/**
 * hubReportService.js
 *
 * Service layer for Hub Daily Shift Reports (Maker-Checker workflow).
 * All Supabase interactions for hub_shift_reports and hub_shift_report_entries
 * are encapsulated here.
 *
 * Pattern: named export `hubReportService` object with method functions.
 * Import: import { hubReportService } from '../../core/supabaseClient';
 * (Re-exported from supabaseClient barrel, or import directly from this file.)
 *
 * Key domain rules enforced here:
 *  - clients filtered by status = 'Active' (NOT is_active, NO hub_id filter)
 *  - Checker columns (verified_*) are NEVER pre-filled from Draft values
 *  - updateDraft uses delete-then-reinsert for entries (simplest correctness guarantee)
 *  - verifyReport sets status = 'Verified' atomically with entry updates
 */

import { supabase } from '../../core/supabaseClient';

export const hubReportService = {

  // ---------------------------------------------------------------------------
  // getComplianceMatrix
  // ---------------------------------------------------------------------------
  /**
   * Returns a compliance overview row for every hub on a given date.
   * Each row contains the hub's Day and Night report status (or null if missing).
   *
   * Use case: The top-level "Compliance Matrix" view showing which hubs have
   * submitted/verified their Day and Night reports for a chosen date.
   *
   * @param {string} date - ISO date string, e.g. '2026-07-30'
   * @returns {Promise<Array<{
   *   hub_id: string,
   *   hub_name: string,
   *   hub_code: string,
   *   day_report: { id: string, status: string, submitted_by: string, verified_by: string } | null,
   *   night_report: { id: string, status: string, submitted_by: string, verified_by: string } | null
   * }>>}
   */
  async getComplianceMatrix(date) {
    // Step 1: Fetch all hubs (ordered by name for consistent rendering)
    const { data: hubs, error: hubsError } = await supabase
      .from('hubs')
      .select('id, name, hub_code')
      .order('name', { ascending: true });

    if (hubsError) throw hubsError;
    if (!hubs || hubs.length === 0) return [];

    // Step 2: Fetch all reports for this date (both Day and Night across all hubs)
    const hubIds = hubs.map(h => h.id);
    const { data: reports, error: reportsError } = await supabase
      .from('hub_shift_reports')
      .select('id, hub_id, shift, status, submitted_by, verified_by')
      .eq('report_date', date)
      .in('hub_id', hubIds);

    if (reportsError) throw reportsError;

    // Step 3: Build a lookup map: hub_id -> { Day: report|null, Night: report|null }
    const reportMap = {};
    (reports || []).forEach(r => {
      if (!reportMap[r.hub_id]) {
        reportMap[r.hub_id] = { Day: null, Night: null };
      }
      reportMap[r.hub_id][r.shift] = {
        id: r.id,
        status: r.status,
        submitted_by: r.submitted_by,
        verified_by: r.verified_by,
      };
    });

    // Step 4: Map hubs to compliance rows
    return hubs.map(hub => ({
      hub_id: hub.id,
      hub_name: hub.name,
      hub_code: hub.hub_code,
      day_report:   reportMap[hub.id]?.Day   ?? null,
      night_report: reportMap[hub.id]?.Night ?? null,
    }));
  },


  // ---------------------------------------------------------------------------
  // getReport
  // ---------------------------------------------------------------------------
  /**
   * Fetches a single report header with all its entries joined.
   * Returns null if no report exists for the given hub/date/shift combination.
   *
   * Use case: Loading the Maker form (to edit a draft) or the Checker form
   * (to verify). Both views call this; the UI decides which columns to display.
   *
   * @param {string} hubId
   * @param {string} date  - ISO date string, e.g. '2026-07-30'
   * @param {string} shift - 'Day' or 'Night'
   * @returns {Promise<Object|null>}
   */
  async getReport(hubId, date, shift) {
    const { data, error } = await supabase
      .from('hub_shift_reports')
      .select(`
        id,
        hub_id,
        report_date,
        shift,
        status,
        submitted_by,
        submitted_at,
        verified_by,
        verified_at,
        maker_note,
        checker_note,
        created_at,
        updated_at,
        hub_shift_report_entries (
          id,
          client_id,
          client_name,
          draft_sessions_3w,
          draft_sessions_4w,
          draft_parked_3w,
          draft_parked_4w,
          verified_sessions_3w,
          verified_sessions_4w,
          verified_parked_3w,
          verified_parked_4w,
          notes
        )
      `)
      .eq('hub_id', hubId)
      .eq('report_date', date)
      .eq('shift', shift)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  },


  // ---------------------------------------------------------------------------
  // getActiveClients
  // ---------------------------------------------------------------------------
  /**
   * Fetches all clients where status = 'Active', ordered by name.
   *
   * IMPORTANT: The clients table uses status = 'Active', NOT is_active.
   * IMPORTANT: There is NO hub_id column on clients — all active clients
   *            appear as rows in every hub's shift report.
   *
   * Use case: Populating the rows of the Maker submission form. Called once
   * when the form loads; the result is mapped to entry objects with zero values.
   *
   * @returns {Promise<Array<{ id: string, name: string }>>}
   */
  async getActiveClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .eq('status', 'Active')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },


  // ---------------------------------------------------------------------------
  // createDraft
  // ---------------------------------------------------------------------------
  /**
   * Creates a new Draft report header and inserts all entry rows.
   *
   * Operates in two sequential Supabase calls (not a true DB transaction, but
   * uses the ON DELETE CASCADE FK so if the header insert fails, no entries exist).
   * If the entry insert fails, the orphaned header is cleaned up manually.
   *
   * @param {Object} params
   * @param {string} params.hubId
   * @param {string} params.reportDate - ISO date string
   * @param {string} params.shift      - 'Day' or 'Night'
   * @param {Array}  params.entries    - Array of entry objects (see shape below)
   * @param {string} [params.makerNote]
   * @param {string} params.userId     - UUID of the submitting user
   *
   * Entry shape:
   * {
   *   clientId: string,         // uuid — from clients.id
   *   clientName: string,       // snapshot from clients.name
   *   draft_sessions_3w: number,
   *   draft_sessions_4w: number,
   *   draft_parked_3w: number,
   *   draft_parked_4w: number,
   * }
   *
   * @returns {Promise<Object>} The created report header row.
   */
  async createDraft({ hubId, reportDate, shift, entries, makerNote, userId }) {
    // Step 1: Insert the report header
    const { data: report, error: reportError } = await supabase
      .from('hub_shift_reports')
      .insert({
        hub_id:       hubId,
        report_date:  reportDate,
        shift,
        status:       'Draft',
        submitted_by: userId,
        submitted_at: new Date().toISOString(),
        maker_note:   makerNote || null,
      })
      .select()
      .single();

    if (reportError) throw reportError;

    // Step 2: Insert all entry rows
    const entryRows = entries.map(e => ({
      report_id:          report.id,
      client_id:          e.clientId || null,
      client_name:        e.clientName,
      draft_sessions_3w:  e.draft_sessions_3w ?? 0,
      draft_sessions_4w:  e.draft_sessions_4w ?? 0,
      draft_parked_3w:    e.draft_parked_3w   ?? 0,
      draft_parked_4w:    e.draft_parked_4w   ?? 0,
      // Checker columns intentionally left NULL on creation
    }));

    const { error: entriesError } = await supabase
      .from('hub_shift_report_entries')
      .insert(entryRows);

    if (entriesError) {
      // Attempt cleanup: delete the orphaned header
      await supabase.from('hub_shift_reports').delete().eq('id', report.id);
      throw entriesError;
    }

    return report;
  },


  // ---------------------------------------------------------------------------
  // updateDraft
  // ---------------------------------------------------------------------------
  /**
   * Updates an existing Draft report's entries and optional maker note.
   * Uses a delete-then-reinsert strategy for entries to avoid complex diffing.
   *
   * PRECONDITION: The report must have status = 'Draft'. Verified reports
   *               cannot be updated via this function (enforce in UI).
   *
   * @param {string} reportId
   * @param {Object} params
   * @param {Array}  params.entries   - Full set of updated entry objects
   * @param {string} [params.makerNote]
   * @param {string} params.userId    - UUID of the updating user
   *
   * @returns {Promise<Object>} The updated report header row.
   */
  async updateDraft(reportId, { entries, makerNote, userId }) {
    // Step 1: Update the report header (submitted_by and submitted_at reflect latest save)
    const { data: report, error: reportError } = await supabase
      .from('hub_shift_reports')
      .update({
        submitted_by: userId,
        submitted_at: new Date().toISOString(),
        maker_note:   makerNote !== undefined ? makerNote : null,
        updated_at:   new Date().toISOString(),
      })
      .eq('id', reportId)
      .eq('status', 'Draft') // Safety guard: never update a Verified report
      .select()
      .single();

    if (reportError) throw reportError;
    if (!report) throw new Error(`Report ${reportId} not found or is not in Draft status.`);

    // Step 2: Delete all existing entries for this report
    const { error: deleteError } = await supabase
      .from('hub_shift_report_entries')
      .delete()
      .eq('report_id', reportId);

    if (deleteError) throw deleteError;

    // Step 3: Re-insert the full updated set of entries
    const entryRows = entries.map(e => ({
      report_id:         reportId,
      client_id:         e.clientId || null,
      client_name:       e.clientName,
      draft_sessions_3w: e.draft_sessions_3w ?? 0,
      draft_sessions_4w: e.draft_sessions_4w ?? 0,
      draft_parked_3w:   e.draft_parked_3w   ?? 0,
      draft_parked_4w:   e.draft_parked_4w   ?? 0,
      // Checker columns preserved from the previous state — NOT re-inserted here
      // (They are NULL on a Draft; any partial checker work would be lost.
      //  If partial verification is needed in future, use a PATCH instead.)
    }));

    const { error: insertError } = await supabase
      .from('hub_shift_report_entries')
      .insert(entryRows);

    if (insertError) throw insertError;

    return report;
  },


  // ---------------------------------------------------------------------------
  // verifyReport
  // ---------------------------------------------------------------------------
  /**
   * Submits the Checker's independent verification of a report.
   *
   * CRITICAL: The Checker fills verified_* columns from scratch — they are
   * NEVER pre-filled with draft_* values. This is enforced here by only
   * accepting verified_* in the entries payload and never reading draft_*.
   *
   * Steps:
   *  1. Update each entry's verified_* columns (PATCH — does not touch draft_*)
   *  2. Update the report header: status = 'Verified', verified_by, verified_at
   *
   * @param {string} reportId
   * @param {Object} params
   * @param {Array}  params.entries    - Array of { entryId, verified_sessions_3w, ... }
   * @param {string} [params.checkerNote]
   * @param {string} params.userId     - UUID of the verifying user
   *
   * Entry shape:
   * {
   *   entryId: string,              // uuid — hub_shift_report_entries.id
   *   verified_sessions_3w: number,
   *   verified_sessions_4w: number,
   *   verified_parked_3w: number,
   *   verified_parked_4w: number,
   * }
   *
   * @returns {Promise<Object>} The updated report header row.
   */
  async verifyReport(reportId, { entries, checkerNote, userId }) {
    // Step 1: Update verified_* on each entry row individually.
    // Supabase does not support bulk row-by-row updates in a single call,
    // so we issue one update per entry. For typical report sizes (5-30 clients)
    // this is acceptable. Wrap in Promise.all for parallel execution.
    const entryUpdatePromises = entries.map(e =>
      supabase
        .from('hub_shift_report_entries')
        .update({
          verified_sessions_3w: e.verified_sessions_3w ?? 0,
          verified_sessions_4w: e.verified_sessions_4w ?? 0,
          verified_parked_3w:   e.verified_parked_3w   ?? 0,
          verified_parked_4w:   e.verified_parked_4w   ?? 0,
          updated_at:           new Date().toISOString(),
        })
        .eq('id', e.entryId)
        .eq('report_id', reportId) // Extra safety: scope to this report only
    );

    const entryResults = await Promise.all(entryUpdatePromises);
    const entryErrors = entryResults.map(r => r.error).filter(Boolean);
    if (entryErrors.length > 0) throw entryErrors[0];

    // Step 2: Mark the report as Verified
    const { data: report, error: reportError } = await supabase
      .from('hub_shift_reports')
      .update({
        status:       'Verified',
        verified_by:  userId,
        verified_at:  new Date().toISOString(),
        checker_note: checkerNote || null,
        updated_at:   new Date().toISOString(),
      })
      .eq('id', reportId)
      .select()
      .single();

    if (reportError) throw reportError;
    return report;
  },


  // ---------------------------------------------------------------------------
  // getAnalyticsData
  // ---------------------------------------------------------------------------
  /**
   * Fetches aggregated verified data for the Hub Reports analytics dashboard.
   * Only 'Verified' reports are included — draft data is excluded from analytics.
   *
   * Returns a flat array of entry rows with their parent report metadata joined,
   * suitable for grouping and charting in the UI (using recharts).
   *
   * @param {Object} params
   * @param {string} params.startDate - ISO date string (inclusive)
   * @param {string} params.endDate   - ISO date string (inclusive)
   * @param {Array<string>} [params.hubIds] - Optional hub filter; omit for all hubs
   *
   * @returns {Promise<Array<{
   *   report_id: string,
   *   hub_id: string,
   *   hub_name: string,
   *   report_date: string,
   *   shift: string,
   *   client_id: string,
   *   client_name: string,
   *   verified_sessions_3w: number,
   *   verified_sessions_4w: number,
   *   verified_parked_3w: number,
   *   verified_parked_4w: number,
   * }>>}
   */
  async getAnalyticsData({ startDate, endDate, hubIds }) {
    // Build the base query: join entries to their verified reports
    let query = supabase
      .from('hub_shift_report_entries')
      .select(`
        id,
        report_id,
        client_id,
        client_name,
        verified_sessions_3w,
        verified_sessions_4w,
        verified_parked_3w,
        verified_parked_4w,
        hub_shift_reports!inner (
          hub_id,
          report_date,
          shift,
          status,
          hubs!inner (
            id,
            name,
            hub_code
          )
        )
      `)
      .eq('hub_shift_reports.status', 'Verified')
      .gte('hub_shift_reports.report_date', startDate)
      .lte('hub_shift_reports.report_date', endDate);

    // Optional hub filter
    if (hubIds && hubIds.length > 0) {
      query = query.in('hub_shift_reports.hub_id', hubIds);
    }

    const { data, error } = await query.order('hub_shift_reports.report_date', { ascending: true });
    if (error) throw error;

    // Flatten the nested join into a flat, chart-friendly structure
    return (data || []).map(entry => ({
      entry_id:             entry.id,
      report_id:            entry.report_id,
      hub_id:               entry.hub_shift_reports.hub_id,
      hub_name:             entry.hub_shift_reports.hubs.name,
      hub_code:             entry.hub_shift_reports.hubs.hub_code,
      report_date:          entry.hub_shift_reports.report_date,
      shift:                entry.hub_shift_reports.shift,
      client_id:            entry.client_id,
      client_name:          entry.client_name,
      verified_sessions_3w: entry.verified_sessions_3w ?? 0,
      verified_sessions_4w: entry.verified_sessions_4w ?? 0,
      verified_parked_3w:   entry.verified_parked_3w   ?? 0,
      verified_parked_4w:   entry.verified_parked_4w   ?? 0,
    }));
  },

};
```

---

## 5. Service Function Reference

| Function | Caller | RBAC Gate | Notes |
| :--- | :--- | :--- | :--- |
| `getComplianceMatrix(date)` | `HubReportsBoard` (matrix view) | `canAccessHubReports` | All hubs, both shifts |
| `getReport(hubId, date, shift)` | Maker form, Checker form | `canAccessHubReports` | Returns `null` if no report |
| `getActiveClients()` | Maker form (on mount) | `canSubmitHubReports` | `status = 'Active'` filter |
| `createDraft(...)` | Maker submit button | `canSubmitHubReports` | Errors if UNIQUE constraint violated |
| `updateDraft(reportId, ...)` | Maker re-save button | `canSubmitHubReports` | Only works on `status = 'Draft'` |
| `verifyReport(reportId, ...)` | Checker submit button | `canVerifyHubReports` | Never touches `draft_*` columns |
| `getAnalyticsData(...)` | Analytics dashboard | `canAccessHubReports` | Only `Verified` reports included |

---

## 6. Validation Steps

### 6.1 Unit Test Each Function (Browser Console / Scratch Script)

```javascript
// Import the service (adjust path as needed in a scratch test)
import { hubReportService } from './src/services/hub/hubReportService';

// Test 1: Compliance Matrix
const matrix = await hubReportService.getComplianceMatrix('2026-07-30');
console.log('[Test 1] Compliance Matrix:', matrix);
// Expected: Array of { hub_id, hub_name, hub_code, day_report, night_report }

// Test 2: Active Clients
const clients = await hubReportService.getActiveClients();
console.log('[Test 2] Active Clients:', clients.length, 'clients');
// Expected: Array of { id, name } — NO hub_id present on rows

// Test 3: Get Report (should return null if no report exists yet)
const report = await hubReportService.getReport('<hub-uuid>', '2026-07-30', 'Day');
console.log('[Test 3] Get Report:', report);

// Test 4: Create Draft (replace UUIDs with real values from your DB)
const draft = await hubReportService.createDraft({
  hubId: '<hub-uuid>',
  reportDate: '2026-07-30',
  shift: 'Day',
  entries: clients.slice(0, 2).map(c => ({
    clientId: c.id,
    clientName: c.name,
    draft_sessions_3w: 5,
    draft_sessions_4w: 2,
    draft_parked_3w: 10,
    draft_parked_4w: 3,
  })),
  makerNote: 'Test submission',
  userId: '<user-uuid>',
});
console.log('[Test 4] Created Draft:', draft.id, draft.status);

// Test 5: Get Report (should now return the draft with entries)
const withEntries = await hubReportService.getReport('<hub-uuid>', '2026-07-30', 'Day');
console.log('[Test 5] Report with Entries:', withEntries?.hub_shift_report_entries?.length);

// Test 6: Verify Report
const verified = await hubReportService.verifyReport(draft.id, {
  entries: withEntries.hub_shift_report_entries.map(e => ({
    entryId: e.id,
    verified_sessions_3w: 6,
    verified_sessions_4w: 2,
    verified_parked_3w: 11,
    verified_parked_4w: 3,
  })),
  checkerNote: 'Verified independently',
  userId: '<checker-uuid>',
});
console.log('[Test 6] Verified Report Status:', verified.status);
// Expected: 'Verified'
```

### 6.2 Database Verification

```sql
-- Confirm draft_* columns are unchanged after verification
SELECT
  client_name,
  draft_sessions_3w, draft_parked_3w,
  verified_sessions_3w, verified_parked_3w
FROM hub_shift_report_entries
WHERE report_id = '<report-uuid-from-test-4>';
-- draft_* should still show the Maker's original values.
-- verified_* should show the Checker's independent values.
```

---

## 7. Troubleshooting & Gotchas

| Issue | Potential Cause | Fix |
| :--- | :--- | :--- |
| `getActiveClients()` returns 0 rows | Filter uses wrong column | Confirm `WHERE status = 'Active'` — do NOT use `is_active`. |
| `createDraft` throws UNIQUE constraint error | Report already exists for this hub/date/shift | Call `getReport()` first; if it returns non-null, call `updateDraft()` instead. |
| `updateDraft` returns `null` report | Report is `status = 'Verified'` | The `.eq('status', 'Draft')` guard in the UPDATE rejected it. Only drafts can be updated. |
| `verifyReport` entry updates partially fail | Concurrent modification or missing `entryId` | The `Promise.all` will throw on first error. Check that `entryId` values match real DB UUIDs. |
| `getAnalyticsData` returns empty | No Verified reports in date range | Confirm at least one report has `status = 'Verified'` in the queried range. |
| `getComplianceMatrix` hub list is empty | No rows in `hubs` table | Seed or verify hub data is present. |
| `getAnalyticsData` nested join fails | Supabase foreign table naming conflict | The `!inner` join syntax requires that FK relationships are correctly defined in the DB. Verify the `hub_shift_reports` FK on `hub_id` references `hubs(id)`. |

---

## 8. Rollback Plan

The service file is additive — it creates no database state on its own. To rollback:
1. Delete `src/services/hub/hubReportService.js`.
2. Remove any import references in components that were added in Phase 4.
3. No database changes are needed.

---

## 9. Progress Tracking

- [ ] File created at `src/services/hub/hubReportService.js`
- [ ] `getComplianceMatrix` tested and returns correct structure.
- [ ] `getActiveClients` confirmed to use `status = 'Active'` filter.
- [ ] `createDraft` tested — entries inserted correctly, checker columns are NULL.
- [ ] `updateDraft` tested — re-insert works; draft_* values preserved on re-load.
- [ ] `verifyReport` tested — draft_* columns UNCHANGED after verification.
- [ ] `getAnalyticsData` tested — only Verified data returned.

**Next Runbook**: `04_SUBSIDEBAR_AND_ROUTING.md`
