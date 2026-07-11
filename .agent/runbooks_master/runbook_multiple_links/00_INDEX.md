# React Router Migration — Master Runbook Index

## Overview

This folder contains a fully phased, sequentially ordered set of runbooks for migrating PowerProject from local state-based navigation (e.g., `useState('attendance')`) to full URL-based routing using `react-router-dom`. 
This upgrade will enable browser Back/Forward functionality, deep linking, F5 refresh persistence, and cleaner component architecture.

---

## Architecture Decisions & Recommendations

### Recommendation 1: The BrowserRouter
We will wrap the highest level of the application (`main.jsx` or `App.jsx`) with `<BrowserRouter>`. This is required to enable URL tracking across the entire app.

### Recommendation 2: The Layout Shell as a Layout Route
Our existing `LayoutShell` and `EmployeeSubSidebar` components should not unmount when switching tabs. We will use React Router's `<Outlet />` system. The Sidebar will be a parent route layout, and the actual boards (Attendance, Leaves) will be child routes that render inside the Outlet.

### Recommendation 3: URL Structure mapping
We will move away from `activeVertical` strings and adopt a RESTful-style UI routing structure:
- `/admin/attendance` -> Attendance Board
- `/admin/leaves` -> Global Leave Management
- `/admin/leaves/employee/:employeeId` -> Deep link to a specific employee's leave wallet
- `/employee/leaves` -> Employee's personal leave view

---

## Phase → Runbook Mapping

| Phase | Runbook | File | Status |
|---|---|---|---|
| **Phase 1: Installation & Setup** | 1.1 Dependency & App Wrapper | [01_SETUP_AND_INSTALLATION.md](./01_SETUP_AND_INSTALLATION.md) | ☐ |
| **Phase 2: Layout Extraction** | 2.1 Refactoring the App Shell to use `<Outlet>` | [02_SHELL_LAYOUT_REFACTOR.md](./02_SHELL_LAYOUT_REFACTOR.md) | ☐ |
| **Phase 3: Route Definitions** | 3.1 Mapping components to URL paths | [03_ROUTE_DEFINITIONS.md](./03_ROUTE_DEFINITIONS.md) | ☐ |
| **Phase 4: State Untangling** | 4.1 Replacing `useState` navigation with `useNavigate` and `useParams` | [04_DEEP_LINKING_STATE.md](./04_DEEP_LINKING_STATE.md) | ☐ |

---

## Execution Rules

1. **Run phases in order.** You cannot define routes before the Router is installed.
2. **Each runbook is atomic.** Complete one before starting the next.
3. **Validate often.** A broken router will crash the entire app. Ensure the app renders after each phase.
