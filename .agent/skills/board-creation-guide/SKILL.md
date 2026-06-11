---
name: Board Creation Guide
description: Step-by-step instructions for adding a new board or management view to PowerProject, including UI routing, sub-sidebar updates, component creation, and RBAC security configuration.
---

# Board Creation Guide

When building a new board or management view in PowerProject, multiple files need to be updated to ensure proper rendering, navigation, and Role-Based Access Control (RBAC) security. Follow these steps systematically.

## 1. Create the Board Component

Create the new component file inside the appropriate vertical directory (e.g., `src/verticals/Employees/EmployeeAttendanceBoard.jsx`).

- Ensure the component receives standard props like `user`, `permissions`, `setActiveVertical`, `isSubSidebarOpen`, etc.
- Use `<MasterPageHeader>` to maintain visual consistency with other boards.
- Add it to the vertical's `index.js` barrel export if one exists, or simply import it where needed.

## 2. Add Navigation in Sub-Sidebar

Locate the vertical's sub-sidebar component (e.g., `src/verticals/Employees/EmployeeSubSidebar.jsx`) and add a navigation button.

```jsx
<div className="employee-tasks-btn-wrapper">
  <button
    className="halo-button employee-tasks-nav-btn"
    style={{ opacity: activeVertical === 'your_new_board_id' ? 1 : 0.7 }}
    onClick={() => setActiveVertical('your_new_board_id')}
  >
    Your Board Name
  </button>
</div>
```

## 3. Update ContentRouter for Rendering

In `src/app/shells/ContentRouter.jsx`, import your new component and add conditional rendering based on the `activeVertical`.

- If it's a standard board that uses the vertical layout, put it inside the fallback `<VerticalWorkspace>`.
- If it's a dedicated management view that needs a clean slate, add an `if (activeVertical === 'your_new_board_id') return <YourBoard />;` before the `<VerticalWorkspace>` fallback.

## 4. Classify View (If Management View)

If your new board is a dedicated management view (e.g., full-page tables, forms) rather than a task board, add its ID to the `MANAGEMENT_VIEWS` array in `src/app/shells/useLayoutShell.js`. This ensures the Shell Architecture uses the correct wrapper for it (Phase 3 forward compatibility). Task boards do not need to be added here.

## 5. Implement RBAC Security

A board must be access-controlled so the system knows who can see and modify it.

### A. Define the Feature Flag
In `src/constants/verticalFeatures.js`, add your board's feature flag to the corresponding vertical array so it appears in the User Management dropdown.

```javascript
  EMPLOYEES: [
    { id: 'canAccessEmployees', label: 'Employees List' },
    // ...
    { id: 'canAccessYourNewBoard', label: 'Your Board Name' }
  ],
```

### B. Grant Master Access
In `src/hooks/useRBAC.js`, ensure "Master" roles have default access:
1. Add the feature name string (the `id` without `canAccess`, e.g., `YourNewBoard`) to the `features` array.
2. Add `canAccessYourNewBoard: true` to the `masterPerms` object.

### C. UI Guards
Inside your component, always use `permissions.canAccessYourNewBoard` (or related CRUD flags if applicable) to hide or disable sensitive actions like "Add Item", "Delete", or "Export".
