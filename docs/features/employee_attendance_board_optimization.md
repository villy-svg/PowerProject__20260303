# Employee Attendance Board Optimization — PRD & TRD

**Status:** `Draft`
**Date Created:** 2026-08-22
**Last Updated:** 2026-08-22
**Author / AI Session:** Antigravity session, Aug 2026

---

## Changelog

| Date | Status Change | Summary of Change |
|---|---|---|
| 2026-08-22 | Draft | Initial document created |

---

## 0. Context & Objectives

### 0a. Core Objective
The `EmployeeAttendanceBoard` component has grown into a 700+ line monolith that acts as an orchestrator for multiple complex features (Schedule Planner, Attendance Viewer, Approval Queues) and suffers from significant performance bottlenecks. We need to refactor it into smaller, composable components and optimize the state management to fix grid painting performance issues where a single cell click forces the entire 7-day grid to re-render for all employees.

### 0b. Success Metrics
- **Metric 1:** The `EmployeeAttendanceBoard.jsx` file is reduced to under 300 lines by extracting state hooks and header components.
- **Metric 2:** Clicking a single cell in the Schedule Planner mode (`paintbrush` active) only re-renders the specific `AttendanceCell` that was clicked, rather than the entire `AttendanceGrid`.
- **Metric 3:** The `employeeSelections` data structure is updated from an array to a nested object `O(1)` map to eliminate linear searches during grid rendering.

### 0c. Out of Scope
- ❌ Adding new features to the attendance or schedule planner flows.
- ❌ Changing any backend Supabase tables, Edge Functions, or RLS policies.
- ❌ Altering the existing mobile vs. desktop visual design (only internal logic changes).

---

## 1. Current State & Dependencies

### 1a. Technical Dependencies

| Type | Name | Path |
|---|---|---|
| Component | EmployeeAttendanceBoard | `src/verticals/Employees/EmployeeAttendanceBoard.jsx` |
| Component | AttendanceGrid | `src/verticals/Employees/attendance/AttendanceGrid.jsx` |
| Component | MasterPageHeader | `src/components/layout/MasterPageHeader.jsx` |
| Hook | useAttendanceBoard | `src/hooks/useAttendanceBoard.js` |
| Hook | useSchedulePlanner | `src/hooks/useSchedulePlanner.js` |

**Other technical notes:**
The bottleneck resides in the way `employeeSelections` updates cause a recreation of `getCellData` which is passed as a fresh reference down to `AttendanceGrid`. Since `AttendanceCell` is not memoized properly, the whole grid re-renders.

### 1b. Product Dependencies (Current User Flow)

**Current flow:**
1. Manager goes to Attendance Board.
2. Selects "Schedule Planner" from the view mode.
3. Selects a paintbrush status.
4. Clicks cells in the grid to mark draft shifts.

**Pain point / gap:**
On each click (step 4), there is noticeable input lag as the UI freezes to re-render every single cell across all employees on the grid.

### 1c. Logical Dependencies (Current Business Rules)

- **Rule 1:** Already submitted/saved attendance cannot be overwritten in planner mode (must show as `is_draft: false`).
- **Rule 2:** `employeeSelections` holds the unsaved draft state before bulk submission to the backend.

### 1d. Data & State Dependencies

**Client-side state (React):**
- [x] useState / useReducer in: `EmployeeAttendanceBoard` (`employeeSelections`, `viewMode`, etc.)
- [ ] React Context: N/A
- [ ] Custom hook: `useAttendanceBoard`, `useSchedulePlanner`

### 1e. Security & Access (RBAC)

| Operation | Admin | Editor | Contributor | Viewer |
|---|---|---|---|---|
| READ | ✅ | ✅ | ✅ | ✅ |
| CREATE | ✅ | ✅ | ❌ | ❌ |
| UPDATE | ✅ | ✅ | ❌ | ❌ |
| DELETE | ✅ | ❌ | ❌ | ❌ |

**Sphere of Influence applies?** Yes
- Managers can only see/plan attendance for their own sphere (managed in `useAttendanceBoard`).
**RLS policy function used:** `get_user_permission_level(vertical_id)`
**Vertical(s) affected:** Employees

---

## 2. Proposed Options & Strategy

### 2a. Technical Options

**Option A — Memoize Cell & Optimize Data Structure (Recommended)**
- Approach: Wrap `AttendanceCell` in `React.memo` with a custom comparator that checks specific fields (`record.attendance_status`, `isEditing`, etc.). Refactor `employeeSelections` to an `O(1)` nested dictionary (`{ [empId]: { [date]: { status, hub } } }`). Extract draft state logic into a `useScheduleDrafting` hook.
- Pros: Drastically improves rendering performance. Easy to read object dictionary. Cleans up the main component.
- Cons: Requires careful tuning of the `React.memo` comparator to ensure cells DO update when they are supposed to.
- Complexity: Medium
- Estimated effort: 2-3 hours

**Option B — Lift Draft State to Context**
- Approach: Move draft state entirely out of `EmployeeAttendanceBoard` into an `AttendanceDraftContext`. Have each `AttendanceCell` subscribe directly to the context for its specific `empId` and `date`.
- Pros: Eliminates top-down prop drilling completely. 
- Cons: Overkill for a local view state. Wrapping in Context adds unnecessary architectural complexity.
- Complexity: Medium
- Estimated effort: 3-4 hours

**Recommended:** Option A — It addresses the exact bottleneck (re-renders and linear lookups) without changing the existing architectural pattern.

### 2b. Product Options (UI/UX)

**Desktop View & Mobile View:**
No changes to the existing UI/UX. The feature will look exactly the same, but the header logic will be extracted to `AttendanceBoardHeader.jsx`, and interactions will feel significantly faster.

### 2c. Logical Options (Business Rule Implementation)

**Option A — Enforce Draft Rules Client-Side (Current)**
- How it works: Placed draft cells are merged with live cell data during rendering.
- Security: Standard, as final validation happens backend-side during submission.
- Risk: None, preserves existing behavior.

**Recommended:** Option A — No backend changes are required for this optimization.

### 2d. Trade-offs (Cost vs. Benefit)

| Dimension | Recommended Approach (React.memo + Hook extraction) | Alternative Approach (Context) |
|---|---|---|
| Security | Neutral | Neutral |
| Speed to ship | Faster | Slower |
| Scalability | High (handles hundreds of cells effortlessly) | High |
| Reversibility | High (git revert) | High |
| Maintenance burden | Low (standard React patterns) | Medium (new Context provider to manage) |

**Summary of recommendation:**
We will implement Option A: React.memo on the cells, nested dictionary for `employeeSelections`, and move header/state logic out of the main file.

### 2e. Rollout & Backward Compatibility

**Feature flag required?** No
**Database migration required?** No
**Mobile app (Capacitor) impact:**
- Does this break older cached app versions? No
- OTA push required after deployment? Yes (to deliver the performance improvements to mobile users)
**Impact on existing users:**
- No flow changes. Users will just experience a faster UI in the planner.

---

## 3. Risks, Mitigation & Verification

### 3a. Technical Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `React.memo` comparator is too strict | Cells don't update visually when clicked | Thoroughly test the paintbrush interactions and pending edit badges |
| Bug in converting array to nested dict | Drafts fail to save or submit | Verify `buildPlannerPayload` accurately reconstructs the array format required by `useSchedulePlanner.saveDraft` |

### 3b. Product Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Extracted header components break mobile layout | Buttons overlap or disappear on small screens | Test on 375px viewport to ensure CSS classes remain intact |

### 3c. Logical Risks (Edge Cases)

| Edge Case | What Goes Wrong | How We Handle It |
|---|---|---|
| Null or unassigned employee IDs in draft state | App crashes during object lookup | Use optional chaining (`employeeSelections[empId]?.[date]`) |
| Live attendance data already exists for a cell | Cell allows being overwritten by draft | Keep the existing guard: if live data exists, return `is_draft: false` and ignore selections |

### 3d. Testing Plan

**Pre-deployment checklist:**

```
[ ] TEST 1 — Paintbrush performance
    Persona: Editor/Admin
    Action: Go to Schedule Planner, select 'Present' paintbrush, click 10 cells rapidly
    Expected: UI responds instantly without lag. Only clicked cells re-render.

[ ] TEST 2 — Draft submission
    Persona: Editor/Admin
    Action: Paint cells, then click 'Save Draft' and 'Submit Plan'
    Expected: Payload is correctly formatted and submitted to the backend without errors.

[ ] TEST 3 — Header interactions
    Persona: Any
    Action: Change dates, switch view modes, open pending requests drawer
    Expected: All header actions work identically to before the refactor.

[ ] TEST 4 — Mobile viewport
    Action: Open feature on 375px width viewport
    Expected: Header renders correctly without horizontal scrolling.
```

### 3e. Rollback & Reversibility

**Is this change reversible without data loss?** ✅ Yes

**Rollback procedure:**
If this is a **frontend-only** change:
1. Revert the commit.
2. Trigger an OTA push via Capacitor.

---

## Implementation Notes

**Status at implementation:** _(leave blank until implemented)_

**Deviations from plan:**
- None

**Final migration name(s):** N/A

**Unexpected discoveries:**

**Follow-up items / future iterations:**
