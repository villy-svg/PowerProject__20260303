# Hub Daily Shift Reports — Maker-Checker System

## Runbook Master Index

This folder contains a phased set of runbooks for implementing the **Hub Daily Shift Report** feature within the Data Manager vertical. Each runbook is self-contained, sequentially ordered, and written so that any low-context model or developer can follow it from start to finish without guessing.

---

## Feature Context (Read First)

### What We're Digitizing

Hub teams currently capture vehicle data in a physical register twice a day (Day shift and Night shift), then share it via WhatsApp. A data team cross-checks those numbers in a separate app. This feature brings both steps into PowerProject.

### The Maker-Checker Workflow

```
HUB OPERATOR (Maker)                   DATA TEAM (Checker)
────────────────────                   ──────────────────────
1. Open Hub Reports board              4. Compliance Tracker shows 🟡 Draft
2. Select Hub + Date + Shift           5. Click [Review] on the draft
3. Enter counts per client             6. Independently enter verified numbers
   → [Save Draft]                         (NO pre-fill from draft — starts blank)
   → Status: Draft (🟡)               7. Click [Verify & Submit]
                                          → Status: Verified (🟢)
```

### Data Captured Per Report

Each report is for one **Hub × Date × Shift** combination. For each active client:

| Field | Description |
|---|---|
| `sessions_3w` | Charging sessions completed — 3-wheelers |
| `sessions_4w` | Charging sessions completed — 4-wheelers |
| `parked_3w` | Vehicles currently parked — 3-wheelers |
| `parked_4w` | Vehicles currently parked — 4-wheelers |

Separate `draft_*` and `verified_*` versions of each field exist on every entry row.

> **Scalability Note**: The schema includes a `notes` column on entries and a `metadata jsonb` column on the report header for future expansion (issues, incidents, etc.).

### Key Design Decisions

| Decision | Rationale |
|---|---|
| `UNIQUE(hub_id, report_date, shift)` | One report per hub per shift per day. Prevents duplicates. |
| Verified columns start NULL | Checkers must independently re-enter data. Pre-fill would defeat the verification purpose. |
| All active clients as rows | Reports show all globally active clients, not hub-filtered. Clients table has no hub linkage. |
| Late submissions allowed | Operators can submit for missed dates. Edit RBAC will be added in a later phase. |
| Desktop-only | All views use desktop layouts. No mobile adaptation planned for this feature. |
| Data Manager vertical | Housed with `board key = 'hub_reports'`. |

---

## Architecture Overview

### New Tables

```
hub_shift_reports          ← One row per hub × date × shift
  └── hub_shift_report_entries   ← One row per client per report
```

### New Files

```
supabase/migrations/
  20260730120000_hub_shift_reports.sql

src/services/hub/
  hubReportService.js

src/verticals/DataManager/components/HubReports/
  HubReportsBoard.jsx        ← Main orchestrator
  ComplianceTracker.jsx      ← Matrix view (default landing)
  ComplianceTracker.css
  ReportEntryForm.jsx        ← Maker entry form
  ReportEntryForm.css
  VerificationForm.jsx       ← Checker verification form
  VerificationForm.css
  AnalyticsDashboard.jsx     ← Charts + summary cards
  AnalyticsDashboard.css
  HubReports.css             ← Shared styles
```

### Modified Files

```
src/constants/verticalFeatures.js        ← Add canAccessHubReports, canSubmitHubReports, canVerifyHubReports
src/hooks/useRBAC.js                     ← Add to masterPerms + features array
src/verticals/DataManager/DataManagerSubSidebar.jsx   ← Add Hub Reports nav button
src/verticals/DataManager/DataManagerWorkspace.jsx    ← Add routing for 'hub_reports'
src/verticals/DataManager/index.js                    ← Export HubReportsBoard
```

---

## Phase → Runbook Mapping

| Phase | Runbook | File | Status |
|---|---|---|---|
| **Phase 1: Database** | | | |
| | 1.1 Schema — Two new tables + RLS | [01_DATABASE_SCHEMA.md](./01_DATABASE_SCHEMA.md) | ☐ |
| **Phase 2: RBAC** | | | |
| | 2.1 Permissions + Sub-sidebar + Routing | [02_RBAC.md](./02_RBAC.md) | ☐ |
| **Phase 3: Service Layer** | | | |
| | 3.1 hubReportService.js | [03_SERVICE_LAYER.md](./03_SERVICE_LAYER.md) | ☐ |
| **Phase 4: Shell Wiring** | | | |
| | 4.1 Sub-sidebar + Workspace routing | [04_SUBSIDEBAR_AND_ROUTING.md](./04_SUBSIDEBAR_AND_ROUTING.md) | ☐ |
| **Phase 5: Compliance Tracker UI** | | | |
| | 5.1 Matrix view — 🔴🟡🟢 status grid | [05_COMPLIANCE_TRACKER.md](./05_COMPLIANCE_TRACKER.md) | ☐ |
| **Phase 6: Entry Form UI** | | | |
| | 6.1 Maker report submission form | [06_ENTRY_FORM.md](./06_ENTRY_FORM.md) | ☐ |
| **Phase 7: Verification Form UI** | | | |
| | 7.1 Checker verification form | [07_VERIFICATION_FORM.md](./07_VERIFICATION_FORM.md) | ☐ |
| **Phase 8: Analytics Dashboard** | | | |
| | 8.1 Line charts + summary cards | [08_ANALYTICS_DASHBOARD.md](./08_ANALYTICS_DASHBOARD.md) | ☐ |

---

## Execution Rules

1. **Run phases in order.** Phase 3 (service) depends on Phase 1 (tables). Phase 5–8 depend on Phase 3 (service).
2. **Each runbook is atomic.** Complete one before starting the next.
3. **Every runbook ends with a validation checklist.** Do NOT proceed until all checks pass.
4. **Migration naming**: `YYYYMMDDHHMMSS_descriptive_name.sql`.
5. **PostgreSQL Kick**: Every migration MUST end with `NOTIFY pgrst, 'reload schema';`.
6. **Staging First**: Push to staging, validate, then merge to main for production.
7. **Desktop Only**: Do not add `@media` mobile breakpoints to any HubReports CSS.

---

## Dependency Graph

```
[01 DB Schema] → [02 RBAC] → [03 Service] → [04 Shell Wiring]
                                                     ↓
                               [05 Tracker] → [06 Entry] → [07 Verify] → [08 Analytics]
```
