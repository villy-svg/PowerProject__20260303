---
name: Feature Planning Workflow
description: >
  Mandatory step-by-step execution guide for creating PRD/TRD documents in docs/features/
  before any feature is built. Activates when a new feature, refactor, or architectural
  change is requested. Works in lockstep with the feature-prd-trd-workflow rule. Read this
  skill entirely before starting any planning document.
---

# Feature Planning Workflow — Execution Skill

## Purpose & When To Use

This skill is your detailed instruction manual for executing the Feature Planning Workflow.
Read it every time you are about to create or update a `docs/features/*.md` document.

The companion rule file (`feature-prd-trd-workflow.md`) tells you **when** to trigger this
workflow. This skill tells you **how** to execute it correctly and completely.

---

## Understanding the Document Directory

All PRD/TRD documents live at:

```
PowerProject/
└── docs/
    └── features/
        ├── _template.md          ← Master template. Never delete or modify.
        ├── feature_name_a.md     ← One file per feature
        └── feature_name_b.md
```

**Before creating any document**, check if a file for this feature already exists:
```
docs/features/<feature_name>.md
```

If it exists, READ the full document first. Preserve all existing approved decisions.
Add a new dated section at the bottom (`## Update: YYYY-MM-DD`) rather than overwriting.

---

## Phase-by-Phase Execution Guide

### ─────────────────────────────────────────────
### PHASE 0 — Context & Objectives
### ─────────────────────────────────────────────

**Goal:** Establish WHY this feature is being built and draw hard boundaries around scope.

**0a. Core Objective**

Write this in one or two sentences that a non-technical stakeholder could understand.
Bad: "We want to implement a module for tracking shifts."
Good: "Employees currently have no way to see their own scheduled shifts from a mobile
device. We need a mobile-first shift viewer so employees can check upcoming shifts without
calling HR."

**0b. Success Metrics**

Define concrete, verifiable criteria. At least two metrics are required:
- Quantitative: "The shift list renders in under 300ms on a 4G connection."
- Qualitative/functional: "A Viewer-role employee can see their own shifts but cannot edit
  or delete any shift."
- User flow: "The complete task (open app → view shift → close app) takes fewer than
  3 taps."

**0c. Out of Scope**

Explicitly list what will NOT be built in this iteration. This is a safeguard against
scope creep. If the user starts asking for additional features mid-execution, you can
point back to this section. Examples:
- "Out of scope: Shift editing from mobile. This will be a separate feature."
- "Out of scope: Push notification for shift reminders. Requires a separate notification
  service evaluation."

---

### ─────────────────────────────────────────────
### PHASE 1 — Current State & Dependencies
### ─────────────────────────────────────────────

**Goal:** Map the existing terrain completely. Hidden dependencies surface here so they
don't become regressions.

**1a. Technical Dependencies**

List every relevant file with its path. Be specific:
- Components: `src/features/Shifts/ShiftList.jsx`, `src/features/Shifts/ShiftCard.jsx`
- Hooks: `src/hooks/useShifts.js`, `src/hooks/useEmployees.js`
- Services: `src/services/shiftService.js`
- Edge Functions: `supabase/functions/entity-archive/`
- Shared utilities: `src/utils/dateUtils.js`
- Route definitions: Where in `App.jsx` or the router is this feature mounted?

**1b. Product Dependencies**

Walk through the current user journey step by step:
1. User lands on X page
2. User sees Y UI element
3. User clicks Z button
4. This triggers A action
5. User sees B result

What currently works and what is the pain point? Where does the experience break down?

**1c. Logical Dependencies**

Document the current business rules that govern this area. These are the laws the code
enforces. Examples:
- "A shift cannot overlap with another shift for the same employee."
- "Shifts can only be created 14 days in advance."
- "Only employees with seniority level ≥ 7 can approve timesheets."
- "A closed shift cannot be reopened once payroll is processed."

Finding these rules requires reading the relevant hook files and Supabase RLS policies.

**1d. Data & State Dependencies**

List every Supabase table involved. For each table, note:
- Table name (e.g., `hr_shifts`)
- Relevant columns (e.g., `id`, `employee_id`, `start_time`, `end_time`, `status`)
- Foreign key relationships (e.g., `employee_id → hr_employees.id`)
- Any relevant Supabase views or computed columns
- Any browser-side state (React Context, useState) that caches this data

Reference `db_types.ts` at the project root for the full, up-to-date type definitions.

**1e. Security & Access (RBAC)**

Answer these specific questions:
- Which roles can READ this data? (Admin / Editor / Contributor / Viewer)
- Which roles can CREATE records?
- Which roles can UPDATE records?
- Which roles can DELETE records?
- Does the Sphere of Influence apply? (i.e., does a Manager with seniority ≤ 6 only see
  their own team's data, or all data across the vertical?)
- Are there any rows that are always read-only regardless of role? (e.g., archived records,
  payroll-processed shifts)
- Which RLS policy functions apply? (The standard is `get_user_permission_level(vertical_id)`)

---

### ─────────────────────────────────────────────
### PHASE 2 — Proposed Options & Strategy
### ─────────────────────────────────────────────

**Goal:** Present multiple viable approaches. Never jump to a single answer. The user
must choose or blend the approach. Debate is the point of this phase.

**2a. Technical Options**

Present at least two options. Structure each like:

```
Option A: [Short Label]
  - Approach: [How it works technically]
  - Pros: [What this does well]
  - Cons: [What this costs or risks]
  - Complexity: Low / Medium / High
  - Timeline estimate: [rough hours or days]

Option B: [Short Label]
  - Approach: [How it works technically]
  - Pros: ...
  - Cons: ...
  - Complexity: ...
  - Timeline estimate: ...
```

Common axis of decisions for PowerProject:
- Client-side hook vs Server-side Edge Function
- New DB column vs computed in JavaScript
- New component vs extending existing union component
- Supabase Realtime subscription vs polling

**2b. Product Options**

What would the user experience look like for each option?

- **Desktop view (DesktopLayout):** High-density management interface. Tables, filters,
  bulk actions. Managers see many records. Think: dense data grid.
- **Mobile view (MobileLayout):** Focused action interface. Card-based. One action per
  screen. Think: swipe to approve, tap to view detail.

Describe what the UI looks like in plain words for each option:
- Where does the feature appear? (Which page, which panel, which section)
- What does the user see on first load?
- What actions are available?
- What does the success state look like?

**2c. Logical Options**

Are there different ways to express the business rule?

Example: For a "shift duration cap" rule:
- Option A: Enforce at database level via a Postgres CHECK constraint. Cannot be bypassed
  by any client.
- Option B: Enforce at Edge Function level. Centralizes logic but is slower.
- Option C: Enforce in the React hook. Fast but can be bypassed by API calls.

State which option enforces the rule most safely and why.

**2d. Trade-offs (Cost vs. Benefit)**

For the RECOMMENDED strategy, write a clear trade-off table:

| Dimension | Recommended Approach | Alternative Approach |
|---|---|---|
| Security | ✅ Enforced at DB level | ⚠️ Frontend only |
| Speed to ship | ⚠️ 2-day migration needed | ✅ No migration |
| Scalability | ✅ Works at any scale | ⚠️ Performance risk at >10k records |
| Reversibility | ⚠️ Migration is irreversible | ✅ Easy to revert |

**2e. Rollout & Backward Compatibility**

Answer these questions:

1. **Feature Flag:** Should this be hidden behind a flag initially? (e.g., only show to
   Admin users first). If yes, describe the flag mechanism.
2. **Database Migration:** Does this require a schema change?
   - If yes, is the migration reversible (can we roll back without data loss)?
   - Does any existing data need to be backfilled?
   - Must follow the `database-migration-policy` skill rules.
3. **Mobile App (Capacitor):** Does this change the app's behavior on mobile?
   - Users who haven't updated via OTA may be on an older version for hours or days.
   - Does the old app version break if this feature is deployed to the backend first?
   - If yes, what backward-compatible API behavior must be maintained?
4. **Existing Users:** Does this change how existing data appears or behaves for current
   users? Alert here if yes.

---

### ─────────────────────────────────────────────
### PHASE 3 — Risks, Mitigation & Verification
### ─────────────────────────────────────────────

**Goal:** Pre-mortem. Imagine the feature shipped and broke something. What broke?
Use that imagination to write mitigations and a testing plan NOW, before coding starts.

**3a. Technical Risks**

For each risk, state: Risk → Impact → Mitigation

Examples of the format:
- Risk: "The new query doesn't use an index and causes full table scans."
  Impact: "Page load time increases to 5+ seconds at scale."
  Mitigation: "Add a Postgres index on `employee_id, start_time` before deploying."

- Risk: "Multiple users update the same record simultaneously."
  Impact: "Last write wins, silently dropping the other user's change."
  Mitigation: "Implement optimistic locking using an `updated_at` timestamp check."

**3b. Product Risks**

- Risk: "Users don't discover the new feature because the entry point is buried."
  Impact: "Low adoption, feature goes unused."
  Mitigation: "Add a tooltip or highlight on first visit."

- Risk: "The new mobile layout replaces a flow that power users are used to."
  Impact: "User complaints, loss of productivity."
  Mitigation: "Keep the old flow accessible until the new one is validated."

**3c. Logical Risks**

Edge cases in the business logic. Think about:
- What happens if required data is missing? (e.g., employee has no manager assigned)
- What happens at boundaries? (e.g., a shift that spans midnight into the next day)
- What happens with time zones? (e.g., server is UTC, user is IST)
- What happens if a background job runs while a user is editing?

**3d. Testing Plan**

Write explicit, specific test scenarios. Each scenario should have:
- Persona (who is testing — which role)
- Action (what they do)
- Expected result (what should happen)

Example format:

```
[ ] TEST 1 — Viewer cannot create shifts
    Persona: Employee with Viewer role
    Action: Navigate to the Shifts page
    Expected: "Create Shift" button is NOT rendered. No API call is possible via the UI.

[ ] TEST 2 — Manager can only see their team's shifts
    Persona: Manager with seniority level 5
    Action: Navigate to the Shifts page
    Expected: Only shifts belonging to direct reports are visible. No other employees' shifts appear.

[ ] TEST 3 — Desktop layout is dense; Mobile layout is card-based
    Action: View the shifts list on a 1440px desktop viewport, then on a 375px mobile viewport
    Expected: Desktop shows a data table. Mobile shows stacked shift cards.
```

At minimum, test scenarios must cover:
- All RBAC roles for the affected feature
- The happy path (all data present and valid)
- The empty state (no records exist)
- The error state (API call fails)
- Mobile and Desktop viewports

**3e. Rollback & Reversibility**

Write the exact steps to undo this feature if something breaks in production:

1. If it is a frontend-only change: "Revert the commit and trigger an OTA push via
   Capacitor to overwrite the cached app bundle."
2. If it involves a DB migration: "Run the down migration: `supabase migration repair`.
   Note: The `X` column will be dropped and any data in it will be lost."
3. If it involves an Edge Function: "Delete or disable the Edge Function in the Supabase
   dashboard. The frontend will fall back to [behavior]."
4. State clearly: **Is this change reversible without data loss? Yes / No / Partial.**

---

## After Execution: Maintaining the Document

Once the feature is built:
- Update the document status to `Implemented`
- Add an `## Implementation Notes` section at the bottom
- Record any deviations from the plan and why they were made
- Record any unexpected discoveries made during implementation
- Record the final migration name (if any) for future reference

This document is now a permanent historical record. Future developers and AI models will
read it to understand WHY a decision was made, not just what was built.

---

## PowerProject-Specific Context (Always Relevant)

A low-context model reading this skill needs the following project background:

- **Tech Stack:** React (Vite), Supabase (Postgres + Edge Functions + RLS), Capacitor
  (iOS/Android hybrid app), Service Worker (PWA), Tailwind is NOT used — CSS is Vanilla.
- **Repo structure:** `src/features/<Domain>/` for feature code, `supabase/functions/` for
  Edge Functions, `docs/` for documentation, `.agent/` for AI rules and skills.
- **DB types:** The full Supabase type definitions are in `db_types.ts` at the root.
- **RBAC:** Every feature must respect `get_user_permission_level(vertical_id)` which
  returns Admin (4), Editor (3), Contributor (2), or Viewer (1).
- **Sphere of Influence:** Users with seniority ≤ 6 can only see their own team's data
  (tasks/records created by them or their downward reporting tree).
- **Adaptive UI:** Desktop (≥1024px) → DesktopLayout (high-density, table-based).
  Mobile (<1024px) → MobileLayout (card-based, action-focused). Both shells share the
  same data hooks — only the rendering shell differs.
- **Mobile OTA:** The app is distributed as a Capacitor hybrid. JS changes can be pushed
  OTA (no app store re-submission needed), but native changes (plugins, permissions) 
  require a full re-submit. Users may be on a stale bundle for 24–48 hours after an OTA push.
- **Production vs Staging:** All schema changes must be tested on the staging Supabase
  project first. Never apply migrations directly to production.
