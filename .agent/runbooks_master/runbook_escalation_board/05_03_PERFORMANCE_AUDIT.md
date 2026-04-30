# Runbook 05.3: Performance Audit (Optimization & Stability Protocol)

## 1. Executive Summary & Architectural Rationale
This final runbook implements the **Performance & Stability Audit**. As a high-performance management tool, PowerProject must maintain a sub-100ms interaction latency even with thousands of tasks. Adding dynamic filters like the Escalation Board can introduce "Calculated Overhead" if not properly memoized.

We focus on two key metrics:
1. **Memoization Stability**: Ensuring the `escalationTasks` filter only re-calculates when necessary.
2. **Component Lifecycle**: Ensuring the `VerticalWorkspace` doesn't re-render redundantly when unrelated state (like the User Profile) changes.
3. **Regression Safety**: Ensuring no logic from the Hubs Escalation Board "Leaks" into the Client or Employee managers.

### 1.1 Scope of Work
- **Target Context**: React Profiler & Application State.
- **Primary Action**: Benchmarking and Regression testing.
- **Expected Outcome**: A 100% optimized, leak-proof implementation.

---

## 2. Verbatim Audit Protocols

### 2.1 Audit Phase A: Memoization Stability Check
1.  **Action**: Open **React Developer Tools** -> **Profiler**.
2.  **Action**: Click the "Settings" icon (gear) -> **General** -> Check "Highlight updates when components render."
3.  **Action**: Click the **Settings** icon in the Master Header (this triggers an unrelated state update).
4.  **Verification**: Observe the `VerticalWorkspace` and the main `App` component.
5.  **Requirement**: The Kanban board should NOT highlight/re-render. If it does, the `escalationTasks` or `tasks` array reference is unstable.
6.  **Action**: Edit a task priority.
7.  **Requirement**: The `VerticalWorkspace` MUST highlight/re-render to reflect the new data.

---

### 2.2 Audit Phase B: Vertical Regression Test
We must verify that our modifications to `App.jsx` (the central router) haven't impacted other verticals.

1.  **Action**: Click the **Vertical Switcher** (top left).
2.  **Action**: Select **Client Manager**.
3.  **Verification Step B.1 (Sidebar)**: 
    - [ ] Confirm the "Escalation Task Board" button is **ABSENT**. 
    - [ ] Confirm standard navigation (Tasks, Clients, Leads) is present.
4.  **Verification Step B.2 (Data)**:
    - [ ] Confirm Client tasks load correctly.
    - [ ] Confirm no Hub-related error messages appear in the console.

---

## 3. Mandatory Defensive Optimization Rules

### 3.1 Dependency Stability Rule
- **Rule 01**: Never include unstable object references in the `useMemo` dependency array of the filter.
- **Reason**: If you include a raw object literal (e.g., `{ active: true }`), the filter will re-calculate on EVERY render because `{}` !== `{}` in JavaScript.

### 3.2 String Literal Rule
- **Rule 02**: Use the exact string `'escalation_tasks'` for checking the active view.
- **Reason**: String comparisons are extremely fast in JavaScript engines. Avoid complex regex or partial matches unless absolutely necessary for performance.

---

## 4. Troubleshooting & Performance Matrix

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **Typing is Laggy** | The `tasks.filter` is running on every keystroke in a form. | Ensure the filter is correctly memoized in `App.jsx`. |
| **"Maximum update depth exceeded"** | Mutual dependency between `activeVertical` and `escalationTasks`. | Verify that the filter logic is "Pure" (no side effects). |
| **Memory usage climbs** | Closure leaks in the `useEffect` persistence logic. | Ensure all subscriptions/events are cleaned up. |

---

## 5. Tool-Specific Instructions for AI Agent

If you are the implementing agent, you MUST provide a "Performance Log":

```javascript
/**
 * PERFORMANCE LOG
 * Board Switch Time: [ms]
 * Filter Calc Time: [ms]
 * Regression Check: [PASSED/FAILED]
 */
```

---

## 6. Final Project Sign-off Matrix

- [ ] **Phase 1 (Security)**: Normalized and restricted access verified.
- [ ] **Phase 2 (Service)**: Inference and database sync verified.
- [ ] **Phase 3 (Logic)**: Filtering and Persistence verified.
- [ ] **Phase 4 (UI)**: Sidebar and Mobile responsiveness verified.
- [ ] **Phase 5 (Polish)**: Labeling and Performance verified.

---

## 7. Rollback Protocol (Emergency Only)

If a critical regression is found:
1. Revert `src/App.jsx` (removes filter and prop wiring).
2. Revert `src/verticals/ChargingHubs/HubSubSidebar.jsx` (removes navigation entry).
3. Revert `src/hooks/useRBAC.js` (removes normalization and flags).
4. **Note**: Do NOT revert `taskService.js` unless the data mapping itself is corrupting the database.

---
**Runbook Status**: `READY FOR EXECUTION`
**Target Sub-Phase**: `5.3` (Final)
**Complexity**: `LOW` (Audit Phase)
**Line Count**: `~215`
