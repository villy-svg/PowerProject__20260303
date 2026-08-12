# [Feature Name] — PRD & TRD

> **Instructions for AI:** Replace [Feature Name] with the actual feature name.
> Fill in every field. Do not leave placeholder text. If a section is not applicable,
> write "N/A — [reason]" so future readers know it was considered, not overlooked.
> Delete all instruction blocks (the `> [!NOTE]` blocks) after filling them in.

**Status:** `Draft`
> Status options: `Draft` → `In Review` → `Approved` → `Implemented`
> Only change to `Approved` when the user has explicitly confirmed the strategy.

**Date Created:** YYYY-MM-DD
**Last Updated:** YYYY-MM-DD
**Author / AI Session:** [Brief description, e.g., "Antigravity session, Aug 2026"]

---

## Changelog

| Date | Status Change | Summary of Change |
|---|---|---|
| YYYY-MM-DD | Draft | Initial document created |

> [!NOTE]
> Add a row to this table every time the document is updated. This is how we track the
> evolution of decisions over time.

---

## 0. Context & Objectives

### 0a. Core Objective
> [!NOTE]
> Write 1–2 sentences describing the ROOT PROBLEM being solved, not just the feature.
> A non-technical stakeholder should be able to read this and understand why we are
> building this. Bad: "Add a shift management feature." Good: "Employees currently have
> no self-service way to view their own scheduled shifts, causing daily HR support calls."

[Replace this with the core objective]

### 0b. Success Metrics
> [!NOTE]
> Define at least 2 measurable, verifiable criteria. Avoid vague goals.
> Good examples: "Shift list renders in < 300ms", "Viewer role cannot trigger a write
> operation via any UI element", "Feature works on 375px mobile viewport without horizontal
> scroll."

- **Metric 1:**
- **Metric 2:**
- **Metric 3 (optional):**

### 0c. Out of Scope
> [!NOTE]
> Explicitly list what will NOT be built in this iteration. This prevents scope creep.
> Reference this list if the user asks for additions mid-execution.

- ❌
- ❌
- ❌

---

## 1. Current State & Dependencies

> [!IMPORTANT]
> This is the most critical phase. Do NOT skip any sub-section. Hidden dependencies
> are the #1 cause of production regressions. Be specific — name actual file paths,
> table names, and column names.

### 1a. Technical Dependencies
> [!NOTE]
> List every React component, hook, service, Edge Function, and route that currently
> touches this feature area. Include file paths.

| Type | Name | Path |
|---|---|---|
| Component | | `src/features/.../` |
| Hook | | `src/hooks/` |
| Service | | `src/services/` |
| Edge Function | | `supabase/functions/` |
| Route | | `App.jsx` or router file |

**Other technical notes:**

### 1b. Product Dependencies (Current User Flow)
> [!NOTE]
> Walk through the current user experience step by step. What does the user see today?
> What is the pain point or gap?

**Current flow:**
1.
2.
3.

**Pain point / gap:**

### 1c. Logical Dependencies (Current Business Rules)
> [!NOTE]
> Document the business rules that currently govern this area. These are the "laws"
> enforced in code. Examples: "A shift cannot overlap with another shift for the same
> employee." Find these by reading the relevant hooks and Supabase RLS policies.

- **Rule 1:**
- **Rule 2:**
- **Rule 3:**

### 1d. Data & State Dependencies
> [!NOTE]
> List every Supabase table, view, or bucket involved. For each, list relevant columns
> and foreign key relationships. Reference db_types.ts at the project root for accuracy.

| Table / View | Relevant Columns | Relationships |
|---|---|---|
| `table_name` | `col_a`, `col_b` | `col_a → other_table.id` |

**Client-side state (React):**
- [ ] useState / useReducer in: [component name]
- [ ] React Context: [context name]
- [ ] Custom hook: [hook name]

### 1e. Security & Access (RBAC)
> [!NOTE]
> Answer all questions below. Do not leave any blank. Reference rbac-and-security.md
> and sphere-of-influence-security.md rules for context.

| Operation | Admin | Editor | Contributor | Viewer |
|---|---|---|---|---|
| READ | ✅ | ✅ | ✅ | ✅ |
| CREATE | ✅ | ✅ | ❌ | ❌ |
| UPDATE | ✅ | ✅ | ❌ | ❌ |
| DELETE | ✅ | ❌ | ❌ | ❌ |

**Sphere of Influence applies?** Yes / No
- If Yes: Describe which seniority levels are restricted and what data they can see.

**RLS policy function used:** `get_user_permission_level(vertical_id)`
**Vertical(s) affected:**

---

## 2. Proposed Options & Strategy

> [!IMPORTANT]
> Present at least TWO options for each relevant sub-section. Do not jump to a single
> answer. The user must choose. Debate is the goal of this phase.

### 2a. Technical Options

**Option A — [Short Label]**
- Approach:
- Pros:
- Cons:
- Complexity: Low / Medium / High
- Estimated effort:

**Option B — [Short Label]**
- Approach:
- Pros:
- Cons:
- Complexity: Low / Medium / High
- Estimated effort:

**Recommended:** Option [A/B] — [One sentence reason]

### 2b. Product Options (UI/UX)

**Desktop View (DesktopLayout — ≥1024px):**
> High-density management interface. Tables, filters, bulk actions. Managers see many
> records simultaneously.

[Describe what the user sees and can do on desktop]

**Mobile View (MobileLayout — <1024px):**
> Focused action interface. Card-based. One action per screen.

[Describe what the user sees and can do on mobile]

**Entry point to this feature:**
- Where does the user navigate from?
- What is the URL/route?
- Is it reachable from the sub-sidebar?

### 2c. Logical Options (Business Rule Implementation)

**Option A — [e.g., Enforce at DB level via CHECK constraint]**
- How it works:
- Security: Cannot be bypassed by any client request
- Risk:

**Option B — [e.g., Enforce in Edge Function]**
- How it works:
- Security: Can be bypassed if Edge Function is skipped
- Risk:

**Recommended:** Option [A/B] — [One sentence reason]

### 2d. Trade-offs (Cost vs. Benefit)

| Dimension | Recommended Approach | Alternative Approach |
|---|---|---|
| Security | | |
| Speed to ship | | |
| Scalability | | |
| Reversibility | | |
| Maintenance burden | | |

**Summary of recommendation:**

### 2e. Rollout & Backward Compatibility

**Feature flag required?** Yes / No
- If Yes: Flag name and which roles see it initially:

**Database migration required?** Yes / No
- If Yes:
  - Migration name: `YYYYMMDDHHMMSS_description.sql`
  - Is migration reversible? Yes / No
  - Data backfill required? Yes / No — describe:

**Mobile app (Capacitor) impact:**
- Does this break older cached app versions? Yes / No
- If Yes: What backward-compatible behavior must the backend maintain?
- OTA push required after deployment? Yes / No

**Impact on existing users:**
- Does any existing record, flow, or behavior change for currently active users? Yes / No
- If Yes: Describe what changes and how users will be informed.

---

## 3. Risks, Mitigation & Verification

### 3a. Technical Risks

> Use format: **Risk** → Impact → Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| | | |
| | | |

### 3b. Product Risks

| Risk | Impact | Mitigation |
|---|---|---|
| | | |
| | | |

### 3c. Logical Risks (Edge Cases)

> Think: missing data, time zones, boundary conditions, concurrent edits, midnight-spanning
> events, users with no manager, archived records being edited, etc.

| Edge Case | What Goes Wrong | How We Handle It |
|---|---|---|
| | | |
| | | |

### 3d. Testing Plan

> [!NOTE]
> Write specific test scenarios. Each must have a Persona, Action, and Expected Result.
> At minimum: cover all RBAC roles, happy path, empty state, error state, mobile & desktop.

**Pre-deployment checklist:**

```
[ ] TEST 1 — [Test name]
    Persona: [Role]
    Action: [What they do]
    Expected: [What should happen]

[ ] TEST 2 — [Test name]
    Persona: [Role]
    Action: [What they do]
    Expected: [What should happen]

[ ] TEST 3 — Empty state
    Persona: [Role]
    Action: Navigate to feature with no data
    Expected: Empty state UI is shown (not a blank page or JS error)

[ ] TEST 4 — Error state
    Persona: [Role]
    Action: Feature loads but API returns an error
    Expected: Error toast is shown, user is not left on a broken screen

[ ] TEST 5 — Mobile viewport
    Action: Open feature on 375px width viewport
    Expected: MobileLayout renders, no horizontal scrolling, all actions accessible

[ ] TEST 6 — Desktop viewport
    Action: Open feature on 1440px width viewport
    Expected: DesktopLayout renders with full density view
```

### 3e. Rollback & Reversibility

**Is this change reversible without data loss?** ✅ Yes / ⚠️ Partial / ❌ No

**Rollback procedure:**

If this is a **frontend-only** change:
1. Revert the commit.
2. Trigger an OTA push via Capacitor.

If this involves a **database migration:**
1. Run: `supabase migration repair --status reverted <migration_id>`
2. ⚠️ NOTE: [Describe any data that will be lost or affected]

If this involves an **Edge Function:**
1. Delete or disable the function in the Supabase dashboard.
2. The frontend will fall back to: [describe fallback behavior]

---

## Implementation Notes

> [!NOTE]
> Fill this section in AFTER the feature is built. Document any deviations from the
> plan, unexpected discoveries, and the final state of the implementation.
> Do not fill this in during planning — it is a post-implementation record.

**Status at implementation:** _(leave blank until implemented)_

**Deviations from plan:**
- None / [List any deviations and why they were made]

**Final migration name(s):**

**Unexpected discoveries:**

**Follow-up items / future iterations:**
