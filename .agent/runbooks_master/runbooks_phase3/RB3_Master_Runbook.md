# Phase 3 Master Runbook — Management Shells

## Objective

Phase 3 introduces dedicated **Management Shells** for Desktop and Mobile. The goal is to provide optimized administrative experiences:
- **Desktop**: Full-width data tables, admin-oriented chrome, without the standard task sidebar.
- **Mobile**: Card-based stacks instead of tables, utilizing bottom sheets for forms and actions.

This runbook provides an extremely granular, step-by-step implementation guide to achieve this architecture without duplicating any business logic.

---

## Pre-Flight Checks

```powershell
# 1. Confirm clean working tree
git status

# 2. Confirm build passes
npm run build
```

---

## Step 1: Implement `WorkspaceFilterContext`

To support separating the presentation of management data and pull the sub-sidebar out into the shell, we must eliminate prop-drilling for filter state.

### 1.1 Create the Context File
**Create File**: `src/app/contexts/WorkspaceFilterContext.jsx`

```jsx
import React, { createContext, useContext, useState } from 'react';

const WorkspaceFilterContext = createContext();

export function WorkspaceFilterProvider({ children }) {
  const [filters, setFilters] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <WorkspaceFilterContext.Provider value={{
      filters,
      searchQuery,
      setSearchQuery,
      updateFilter
    }}>
      {children}
    </WorkspaceFilterContext.Provider>
  );
}

export function useWorkspaceFilters() {
  const context = useContext(WorkspaceFilterContext);
  if (!context) {
    throw new Error('useWorkspaceFilters must be used within a WorkspaceFilterProvider');
  }
  return context;
}
```

### 1.2 Inject the Provider into the App Tree
**Modify**: `src/App.jsx` or `src/app/shells/LayoutShell.jsx` (depending on Phase 2 completion)

Import and wrap the application tree in the provider so that both the shells (which hold the sub-sidebar) and the content (which holds the task boards) have access to the same filters.

```diff
+ import { WorkspaceFilterProvider } from './app/contexts/WorkspaceFilterContext';

  return (
    <AppNavigationProvider>
+     <WorkspaceFilterProvider>
        <LayoutShell user={user} permissions={permissions}>
          <ContentRouter />
        </LayoutShell>
+     </WorkspaceFilterProvider>
    </AppNavigationProvider>
  );
```

### 1.3 Remove Local Filter State from `VerticalWorkspace`
**Modify**: `src/components/workspace/VerticalWorkspace.jsx`

```diff
- const [filters, setFilters] = useState({});
- const [searchQuery, setSearchQuery] = useState('');
+ import { useWorkspaceFilters } from '../../app/contexts/WorkspaceFilterContext';
+
+ const { filters, searchQuery, setSearchQuery, updateFilter } = useWorkspaceFilters();
```

---

## Step 2: Create Management Shell Components

Create the layout containers that will wrap the management pages.

### 2.1 Create the Desktop Management Shell
**Create File**: `src/app/shells/DesktopManagementShell.jsx`

```jsx
import React from 'react';
import './DesktopManagementShell.css';

const DesktopManagementShell = ({ children, layout, user }) => {
  return (
    <div className="desktop-management-shell">
      {/* Space reserved for MasterPageHeader if not handled by LayoutShell */}
      <div className="management-content-full-width">
        {children}
      </div>
    </div>
  );
};

export default DesktopManagementShell;
```

### 2.2 Create Desktop Management CSS
**Create File**: `src/app/shells/DesktopManagementShell.css`

```css
.desktop-management-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 24px;
  background-color: var(--surface-background);
}

.management-content-full-width {
  flex: 1;
  width: 100%;
  max-width: 1400px; /* Constrain ultra-wide monitors but allow wide tables */
  margin: 0 auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
}
```

### 2.3 Create the Mobile Management Shell
**Create File**: `src/app/shells/MobileManagementShell.jsx`

```jsx
import React from 'react';
import './MobileManagementShell.css';

const MobileManagementShell = ({ children, layout }) => {
  return (
    <div className="mobile-management-shell">
      {/* Mobile-specific scrollable card container */}
      <div className="management-content-cards">
        {children}
      </div>
    </div>
  );
};

export default MobileManagementShell;
```

### 2.4 Create Mobile Management CSS
**Create File**: `src/app/shells/MobileManagementShell.css`

```css
.mobile-management-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: var(--background-light);
  overflow-y: auto;
  padding: 16px;
}

.management-content-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
```

### 2.5 Export Shells from Barrel File
**Modify**: `src/app/shells/index.js`
```diff
  export { default as DesktopLayout } from './DesktopLayout';
  export { default as MobileLayout } from './MobileLayout';
+ export { default as DesktopManagementShell } from './DesktopManagementShell';
+ export { default as MobileManagementShell } from './MobileManagementShell';
```

---

## Step 3: Wire up `LayoutShell` to use Management Shells

### 3.1 Import Management Shells
**Modify**: `src/app/shells/LayoutShell.jsx`
```jsx
import DesktopManagementShell from './DesktopManagementShell';
import MobileManagementShell from './MobileManagementShell';
```

### 3.2 Conditionally Wrap Children in DesktopLayout
Inside the `layout.shellType === 'desktop'` block:
```diff
    return (
      <DesktopLayout {...shellProps}>
+       {layout.isManagementView ? (
+         <DesktopManagementShell {...shellProps}>{children}</DesktopManagementShell>
+       ) : (
+         children
+       )}
      </DesktopLayout>
    );
```

### 3.3 Conditionally Wrap Children in MobileLayout
Inside the fallback mobile return block:
```diff
    return (
      <MobileLayout {...shellProps}>
+       {layout.isManagementView ? (
+         <MobileManagementShell {...shellProps}>{children}</MobileManagementShell>
+       ) : (
+         children
+       )}
      </MobileLayout>
    );
```

---

## Step 4: Extract the Sub-Sidebar

Currently, `VerticalWorkspace.jsx` renders the sub-sidebar. This needs to be moved entirely into the shells so that management views do not render the task sub-sidebar on desktop.

### 4.1 Delete Sub-Sidebar from VerticalWorkspace
**Modify**: `src/components/workspace/VerticalWorkspace.jsx`
- Remove `import SubSidebar from '../layout/SubSidebar';`
- Delete `<SubSidebar />` and its container from the JSX return completely.

### 4.2 Inject Sub-Sidebar into DesktopLayout
**Modify**: `src/app/shells/DesktopLayout.jsx`
- Import `SubSidebar`.
- Add conditional rendering to the inline sidebar panel so it only mounts for task views.
```diff
+ import SubSidebar from '../../components/layout/SubSidebar';

  const DesktopLayout = ({ children, layout, ...props }) => {
    return (
      <div className="desktop-layout">
        {/* Only render SubSidebar if NOT a management view */}
+       {!layout.isManagementView && (
+         <div className="desktop-sub-sidebar-container">
+           <SubSidebar />
+         </div>
+       )}
        <div className="desktop-content-area">
          {children}
        </div>
      </div>
    );
  }
```

### 4.3 Update Sub-Sidebar to use Context
**Modify**: `src/components/layout/SubSidebar.jsx`
Remove any prop dependencies for `filters` or `onFilterChange`. Instead, pull these directly from context.
```diff
- const SubSidebar = ({ filters, onFilterChange, activeVertical }) => {
+ import { useWorkspaceFilters } from '../../app/contexts/WorkspaceFilterContext';
+ import { useAppNavigation } from '../../app/contexts/AppNavigationContext';
+
+ const SubSidebar = () => {
+   const { filters, updateFilter } = useWorkspaceFilters();
+   const { activeVertical } = useAppNavigation();
```

---

## Step 5: Management Page Refactoring Blueprint

We must split existing management pages (e.g. `HubManagement`) into three pieces. This ensures we don't duplicate state/API logic. This step should be repeated for **every** management page.

### 5.1 Create the Data Container (Entry Point)
**Modify**: `src/pages/management/HubManagement/HubManagement.jsx`
This file becomes a pure orchestrator. No HTML/CSS presentation elements should exist here.
```jsx
import { useLayoutShell } from '../../../app/shells/useLayoutShell';
import HubManagementDesktop from './HubManagementDesktop';
import HubManagementMobile from './HubManagementMobile';
import { useHubData } from '../../../hooks/useHubData'; // Assume extracted hook

export default function HubManagement() {
  const { shellType } = useLayoutShell();
  
  // 1. All hooks, state, and API calls go here
  const { hubs, loading, deleteHub, updateHub } = useHubData(); 
  
  // 2. Pass data and callbacks down
  if (shellType === 'desktop') {
    return <HubManagementDesktop hubs={hubs} loading={loading} onDelete={deleteHub} onUpdate={updateHub} />;
  }
  
  return <HubManagementMobile hubs={hubs} loading={loading} onDelete={deleteHub} onUpdate={updateHub} />;
}
```

### 5.2 Create the Desktop View (Tables & Admin Chrome)
**Create**: `src/pages/management/HubManagement/HubManagementDesktop.jsx`
- Renders a `<Table>` component with columns for Hub Name, Location, Status.
- Actions trigger standard desktop modals or inline editing.
- Implements full-width formatting suited for wide monitors.

### 5.3 Create the Mobile View (Cards & Bottom Sheets)
**Create**: `src/pages/management/HubManagement/HubManagementMobile.jsx`
- Renders an array of `<Card>` components, one for each Hub.
- Removes standard tables entirely.
- Tapping a card opens a Bottom Sheet (using a `BottomSheet` component) to edit or view details instead of a desktop modal.
- Includes mobile pull-to-refresh if supported by the hook.

### 5.4 Update Router and Clean Up
- Ensure that `src/App.jsx` or `ContentRouter.jsx` still correctly imports the main `HubManagement.jsx` orchestrator.
- Delete any old CSS files that mixed desktop and mobile styles (`HubManagement.css`), replacing them with `HubManagementDesktop.css` and `HubManagementMobile.css`.

---

## Verification Checklist

1. [ ] **Routing Test**: Navigate to `/hub_management` on a desktop viewport. Verify the full-width table appears and the task sidebar is successfully hidden.
2. [ ] **Mobile Test**: Switch to mobile viewport (DevTools). Verify `/hub_management` renders the card stack view without breaking the app.
3. [ ] **State Integrity**: Modify a filter, sort a table, or interact with a form. Ensure that resizing the browser between desktop/mobile breakpoints retains the state (verifying that the Data Container didn't unmount).
4. [ ] **Task Board Test**: Navigate back to a vertical workspace. Ensure the sub-sidebar returns on the left and the standard task board renders correctly with working filters.

## Git Checkpoint

```powershell
git add -A
git commit -m "RB3: Complete Phase 3 Management Shell infrastructure and page refactoring"
```
