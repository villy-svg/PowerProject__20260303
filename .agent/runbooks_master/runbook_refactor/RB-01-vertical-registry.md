# RB-01 — Create `verticalRegistry.js`

**Risk Level**: 🟡 Low | **Depends On**: Nothing | **Est. Time**: 1 hour

> ⛔ **BACKEND SAFETY**: This runbook creates one new file and edits 3 frontend files.
> It does NOT touch `src/services/`, Supabase schema, or any migration files.
> If you find yourself editing anything in `supabase/` — STOP.

---

## Problem

Three files duplicate vertical-routing ternary chains mapping `activeVertical` → components:
- `src/App.jsx` lines ~562–578 (SidebarComponent, TaskFormComponent, TaskTileComponent)
- `src/components/VerticalWorkspace.jsx` lines ~130–136 (rootVerticalId)
- `src/components/TaskController.jsx` line ~215 (CSV export conditional)

---

## Pre-Flight: Verify these files exist

```
src/verticals/ChargingHubs/HubSubSidebar.jsx
src/verticals/ChargingHubs/HubTaskForm.jsx
src/verticals/ChargingHubs/HubTaskTile.jsx
src/verticals/Employees/EmployeeSubSidebar.jsx
src/verticals/Employees/EmployeeTaskForm.jsx
src/verticals/Employees/EmployeeTaskTile.jsx
src/verticals/Clients/ClientSubSidebar.jsx
src/verticals/Clients/ClientTaskForm.jsx
src/verticals/Clients/ClientTaskTile.jsx
```

---

## Step 1 — Create `src/registry/` directory

```powershell
mkdir src/registry
```

---

## Step 2 — Create `src/registry/verticalRegistry.js`

```js
/**
 * verticalRegistry.js
 * Single source of truth for mapping activeVertical IDs → vertical-specific
 * React components and derived labels.
 *
 * RULE: When adding a new vertical, ONLY update this file.
 * No other file should contain vertical-routing ternaries.
 */
import HubSubSidebar from '../verticals/ChargingHubs/HubSubSidebar';
import HubTaskForm from '../verticals/ChargingHubs/HubTaskForm';
import HubTaskTile from '../verticals/ChargingHubs/HubTaskTile';
import EmployeeSubSidebar from '../verticals/Employees/EmployeeSubSidebar';
import EmployeeTaskForm from '../verticals/Employees/EmployeeTaskForm';
import EmployeeTaskTile from '../verticals/Employees/EmployeeTaskTile';
import ClientSubSidebar from '../verticals/Clients/ClientSubSidebar';
import ClientTaskForm from '../verticals/Clients/ClientTaskForm';
import ClientTaskTile from '../verticals/Clients/ClientTaskTile';

/** All activeVertical values belonging to ChargingHubs vertical */
export const HUB_VIEWS = [
  'hub_tasks',
  'daily_hub_tasks',
  'daily_task_templates',
  'escalation_tasks',
];

/** All activeVertical values belonging to Employees vertical */
export const EMPLOYEE_VIEWS = ['employee_tasks'];

/** All activeVertical values belonging to Clients vertical */
export const CLIENT_VIEWS = ['client_tasks', 'leads_funnel'];

/**
 * resolveVerticalComponents(activeVertical, verticals)
 * Returns { SidebarComponent, TaskFormComponent, TaskTileComponent }
 */
export function resolveVerticalComponents(activeVertical, verticals = {}) {
  const hubId    = verticals?.CHARGING_HUBS?.id;
  const empId    = verticals?.EMPLOYEES?.id;
  const clientId = verticals?.CLIENTS?.id;

  const isHub    = activeVertical === hubId    || HUB_VIEWS.includes(activeVertical);
  const isEmp    = activeVertical === empId    || EMPLOYEE_VIEWS.includes(activeVertical);
  const isClient = activeVertical === clientId || CLIENT_VIEWS.includes(activeVertical);

  if (isHub)    return { SidebarComponent: HubSubSidebar,      TaskFormComponent: HubTaskForm,      TaskTileComponent: HubTaskTile };
  if (isEmp)    return { SidebarComponent: EmployeeSubSidebar, TaskFormComponent: EmployeeTaskForm, TaskTileComponent: EmployeeTaskTile };
  if (isClient) return { SidebarComponent: ClientSubSidebar,   TaskFormComponent: ClientTaskForm,   TaskTileComponent: ClientTaskTile };
  return { SidebarComponent: null, TaskFormComponent: null, TaskTileComponent: null };
}

/**
 * resolveVerticalRootId(activeVertical, verticals)
 * Returns the canonical root vertical ID for RBAC and task filtering.
 */
export function resolveVerticalRootId(activeVertical, verticals = {}) {
  const hubId    = verticals?.CHARGING_HUBS?.id;
  const empId    = verticals?.EMPLOYEES?.id;
  const clientId = verticals?.CLIENTS?.id;

  if (activeVertical === hubId    || HUB_VIEWS.includes(activeVertical))    return hubId;
  if (activeVertical === empId    || EMPLOYEE_VIEWS.includes(activeVertical)) return empId;
  if (activeVertical === clientId || CLIENT_VIEWS.includes(activeVertical))  return clientId;
  return (activeVertical || '').toUpperCase();
}

/**
 * resolveVerticalLabels(activeVertical, verticals)
 * Returns { label, boardLabel } for workspace header display.
 */
export function resolveVerticalLabels(activeVertical, verticals = {}) {
  const hubId    = verticals?.CHARGING_HUBS?.id;
  const empId    = verticals?.EMPLOYEES?.id;
  const clientId = verticals?.CLIENTS?.id;

  const map = {
    hub_tasks:            { label: 'Hubs List', boardLabel: 'Hub Task Board' },
    daily_hub_tasks:      { label: 'Hubs List', boardLabel: 'Daily Task Board' },
    daily_task_templates: { label: 'Hubs List', boardLabel: 'Daily Task Templates' },
    escalation_tasks:     { label: 'Hubs List', boardLabel: 'Escalation Task Board' },
    employee_tasks:       { label: 'Employees', boardLabel: 'Employee Task Board' },
    client_tasks:         { label: 'Clients',   boardLabel: 'Client Task Board' },
    leads_funnel:         { label: 'Clients',   boardLabel: 'Client Task Board' },
  };
  if (hubId)    map[hubId]    = { label: 'Hubs List', boardLabel: 'Hubs Task Board' };
  if (empId)    map[empId]    = { label: 'Employees', boardLabel: 'Employee Task Board' };
  if (clientId) map[clientId] = { label: 'Clients',   boardLabel: 'Client Task Board' };

  return map[activeVertical] || { label: verticals[activeVertical]?.label || '', boardLabel: 'Board' };
}

/**
 * resolveHeaderClickTarget(activeVertical, verticals, permissions)
 * Returns the navigation target when sub-sidebar header is clicked, or null.
 */
export function resolveHeaderClickTarget(activeVertical, verticals = {}, permissions = {}) {
  const hubId    = verticals?.CHARGING_HUBS?.id;
  const empId    = verticals?.EMPLOYEES?.id;
  const clientId = verticals?.CLIENTS?.id;

  if (activeVertical === 'employee_tasks') return empId || null;
  if (CLIENT_VIEWS.includes(activeVertical)) return clientId || null;

  const isHubConfigView = (
    activeVertical === hubId ||
    activeVertical === 'hub_tasks' ||
    activeVertical === 'daily_hub_tasks' ||
    activeVertical === 'daily_task_templates'
  );
  if (isHubConfigView && permissions?.canAccessConfig) return 'hub_management';
  return null;
}
```

---

## Step 3 — Update `src/App.jsx`

### 3a. Add registry import (after hook imports, before component imports)
```js
import { resolveVerticalComponents, resolveVerticalLabels, resolveHeaderClickTarget } from './registry/verticalRegistry';
```

### 3b. DELETE these 9 import lines from App.jsx
```js
import HubSubSidebar from './verticals/ChargingHubs/HubSubSidebar';
import HubTaskForm from './verticals/ChargingHubs/HubTaskForm';
import HubTaskTile from './verticals/ChargingHubs/HubTaskTile';
import EmployeeSubSidebar from './verticals/Employees/EmployeeSubSidebar';
import EmployeeTaskForm from './verticals/Employees/EmployeeTaskForm';
import EmployeeTaskTile from './verticals/Employees/EmployeeTaskTile';
import ClientSubSidebar from './verticals/Clients/ClientSubSidebar';
import ClientTaskForm from './verticals/Clients/ClientTaskForm';
import ClientTaskTile from './verticals/Clients/ClientTaskTile';
```

### 3c. Add derived values just BEFORE the `return (` statement in App()
```js
const { SidebarComponent, TaskFormComponent, TaskTileComponent } =
  resolveVerticalComponents(activeVertical, verticals);
const { label: workspaceLabel, boardLabel: workspaceBoardLabel } =
  resolveVerticalLabels(activeVertical, verticals);
const headerClickTarget =
  resolveHeaderClickTarget(activeVertical, verticals, currentUserPermissions);
```

### 3d. In the `<VerticalWorkspace>` JSX block, replace the 6 prop ternary chains

**REMOVE** these prop expressions (the long ternary chains for label, boardLabel, SidebarComponent, TaskFormComponent, TaskTileComponent, onHeaderClick).

**REPLACE WITH**:
```jsx
label={workspaceLabel}
boardLabel={workspaceBoardLabel}
SidebarComponent={SidebarComponent}
TaskFormComponent={TaskFormComponent}
TaskTileComponent={TaskTileComponent}
onHeaderClick={headerClickTarget ? () => setActiveVertical(headerClickTarget) : null}
```

---

## Step 4 — Update `src/components/VerticalWorkspace.jsx`

### 4a. Add import at top
```js
import { resolveVerticalRootId } from '../registry/verticalRegistry';
```

### 4b. Find and REPLACE the rootVerticalId computation block (~lines 130–136)

REMOVE:
```js
const rootVerticalId =
  (activeVertical === verticals.CHARGING_HUBS?.id || activeVertical === 'hub_tasks' || ...) ? verticals.CHARGING_HUBS?.id :
  ...
  (activeVertical || '').toUpperCase();
```

REPLACE WITH:
```js
const rootVerticalId = resolveVerticalRootId(activeVertical, verticals);
```

Also find and REMOVE the line below it (the `isFeatureView` line references the old manual check):
The `isFeatureView` line is fine to keep as-is since it uses `activeVertical` directly.

---

## Step 5 — Update `src/components/TaskController.jsx`

### 5a. Add import
```js
import { HUB_VIEWS } from '../registry/verticalRegistry';
```

### 5b. Find the hub CSV conditional (~line 215) and simplify

REMOVE:
```jsx
{(activeVertical === verticals.CHARGING_HUBS?.id || activeVertical === 'hub_tasks' || activeVertical === 'daily_hub_tasks' || activeVertical === 'escalation_tasks') && (
```

REPLACE WITH:
```jsx
{(activeVertical === verticals?.CHARGING_HUBS?.id || HUB_VIEWS.includes(activeVertical)) && (
```

---

## Step 6 — Verification

### 6a. Grep — confirm no vertical ternary chains remain in App.jsx
```powershell
Get-ChildItem "src" -Filter "App.jsx" -Recurse | Select-String -Pattern "HubSubSidebar|EmployeeSubSidebar|ClientSubSidebar"
# Must return ZERO lines
```

### 6b. Build
```powershell
npm run build:staging
```
Expected: `✓ built` with zero errors.

### 6c. Smoke test in browser (http://localhost:5173)
- Hub Task Board loads with tasks ✓
- Employee workspace loads ✓
- Client workspace loads ✓
- Hub Tasks sub-view loads ✓
- Daily Task Board loads ✓
- Escalation Task Board loads ✓

---

## Rollback

If anything breaks:
1. Restore `src/App.jsx`, `VerticalWorkspace.jsx`, `TaskController.jsx` from git
2. Delete `src/registry/` directory
3. Run `npm run build:staging` to confirm baseline restored

## Commit Checkpoint

After the build succeeds:
```powershell
git add -A
git commit -m "refactor: RB-01 add verticalRegistry.js"
```
