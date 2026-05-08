# RB-08 — Create Vertical Barrel Exports

**Risk Level**: 🟢 Minimal | **Depends On**: RB-07 complete | **Est. Time**: 30 minutes

> ⛔ **BACKEND SAFETY**: This runbook creates index.js barrel files in verticals.
> No logic changes, no service changes, no Supabase schema changes.

> ⚠️ **BARREL FILE RISK**: A barrel that exports a file that DOESN'T EXIST will fail
> the build with `Cannot resolve module`. Complete the pre-flight checks before
> creating any barrel file.

---

## Problem

Each vertical component is imported by its full file path in App.jsx and the registry:
```js
import HubManagement from './verticals/ChargingHubs/HubManagement';
import HubFunctionManagement from './verticals/ChargingHubs/HubFunctionManagement';
// ... 15 more lines like this
```

When a vertical grows new components, consumers must add new import lines everywhere.
A barrel `index.js` provides a single stable import surface per vertical.

---

## Objective

Create `index.js` barrel files for ChargingHubs, Employees, and Clients verticals.
Update `App.jsx` and `verticalRegistry.js` to import from the barrels.

---

## Pre-Flight Checks

```powershell
# Confirm no index.js files exist yet in verticals
Get-ChildItem "src/verticals" -Filter "index.js" -Recurse
# Should return nothing
```

**CRITICAL: Verify every component listed in the barrel files actually exists.**
Run these commands and note any filenames that are NOT in the output — remove those
export lines from the barrel file before saving:

```powershell
# ChargingHubs — verify all components that will be exported:
Get-ChildItem "src/verticals/ChargingHubs" -Name | Sort-Object

# Employees — verify all components:
Get-ChildItem "src/verticals/Employees" -Name | Sort-Object

# Clients — verify all components:
Get-ChildItem "src/verticals/Clients" -Name | Sort-Object
```

For any export line where the target `.jsx` file does NOT appear in the output above,
delete that line from the barrel. Do NOT create placeholder files.

---

## Step 1 — Create `src/verticals/ChargingHubs/index.js`

```js
/**
 * ChargingHubs vertical barrel export.
 * Import all ChargingHubs components from this file.
 *
 * RULE: When adding a new component to ChargingHubs, export it here.
 * Consumers never import from individual files in this folder.
 */

// Core vertical components
export { default as HubSubSidebar } from './HubSubSidebar';
export { default as HubManagement } from './HubManagement';
export { default as HubFunctionManagement } from './HubFunctionManagement';
export { default as DailyTasksManagement } from './DailyTasksManagement';

// Task form + tile
export { default as HubTaskForm } from './HubTaskForm';
export { default as HubTaskTile } from './HubTaskTile';

// Hub selector widget
export { default as HubSelector } from './HubSelector';

// CSV tools
export { default as HubCSVDownload } from './HubCSVDownload';
export { default as HubCSVImport } from './HubCSVImport';
export { default as FunctionCSVDownload } from './FunctionCSVDownload';
export { default as FunctionCSVImport } from './FunctionCSVImport';
export { default as TaskCSVDownload } from './TaskCSVDownload';
export { default as TaskCSVImport } from './TaskCSVImport';
```

---

## Step 2 — Create `src/verticals/Employees/index.js`

```js
/**
 * Employees vertical barrel export.
 */

// Core vertical components
export { default as EmployeeSubSidebar } from './EmployeeSubSidebar';
export { default as EmployeeManagement } from './EmployeeManagement';
export { default as DepartmentManagement } from './DepartmentManagement';
export { default as EmployeeRoleManagement } from './EmployeeRoleManagement';

// Task form + tile
export { default as EmployeeTaskForm } from './EmployeeTaskForm';
export { default as EmployeeTaskTile } from './EmployeeTaskTile';

// Sub-components (exported for potential re-use)
export { default as EmployeeCard } from './EmployeeCard';
export { default as EmployeeListRow } from './EmployeeListRow';
export { default as EmployeeForm } from './EmployeeForm';
export { default as EmployeeTree } from './EmployeeTree';
export { default as EmployeeTreeCard } from './EmployeeTreeCard';
export { default as EmployeeBulkUpdateModal } from './EmployeeBulkUpdateModal';

// CSV tools
export { default as EmployeeCSVDownload } from './EmployeeCSVDownload';
export { default as EmployeeCSVImport } from './EmployeeCSVImport';
export { default as DepartmentCSVDownload } from './DepartmentCSVDownload';
export { default as DepartmentCSVImport } from './DepartmentCSVImport';
export { default as EmployeeRoleCSVDownload } from './EmployeeRoleCSVDownload';
export { default as EmployeeRoleCSVImport } from './EmployeeRoleCSVImport';
```

---

## Step 3 — Create `src/verticals/Clients/index.js`

```js
/**
 * Clients vertical barrel export.
 */

// Core vertical components
export { default as ClientSubSidebar } from './ClientSubSidebar';
export { default as ClientManagement } from './ClientManagement';
export { default as ClientCategoryManagement } from './ClientCategoryManagement';
export { default as ClientBillingModelManagement } from './ClientBillingModelManagement';
export { default as ClientServiceManagement } from './ClientServiceManagement';

// Task form + tile
export { default as ClientTaskForm } from './ClientTaskForm';
export { default as ClientTaskTile } from './ClientTaskTile';

// Sub-components
export { default as ClientCard } from './ClientCard';
export { default as ClientListRow } from './ClientListRow';
export { default as ClientForm } from './ClientForm';

// CSV tools
export { default as ClientCSVDownload } from './ClientCSVDownload';
export { default as ClientCSVImport } from './ClientCSVImport';
export { default as ClientCategoryCSVDownload } from './ClientCategoryCSVDownload';
export { default as ClientCategoryCSVImport } from './ClientCategoryCSVImport';
export { default as ClientBillingModelCSVDownload } from './ClientBillingModelCSVDownload';
export { default as ClientBillingModelCSVImport } from './ClientBillingModelCSVImport';
```

---

## Step 4 — Update `src/registry/verticalRegistry.js`

Replace the 9 individual component imports with barrel imports:

REMOVE:
```js
import HubSubSidebar from '../verticals/ChargingHubs/HubSubSidebar';
import HubTaskForm from '../verticals/ChargingHubs/HubTaskForm';
import HubTaskTile from '../verticals/ChargingHubs/HubTaskTile';
import EmployeeSubSidebar from '../verticals/Employees/EmployeeSubSidebar';
import EmployeeTaskForm from '../verticals/Employees/EmployeeTaskForm';
import EmployeeTaskTile from '../verticals/Employees/EmployeeTaskTile';
import ClientSubSidebar from '../verticals/Clients/ClientSubSidebar';
import ClientTaskForm from '../verticals/Clients/ClientTaskForm';
import ClientTaskTile from '../verticals/Clients/ClientTaskTile';
```

ADD:
```js
import {
  HubSubSidebar, HubTaskForm, HubTaskTile,
} from '../verticals/ChargingHubs';

import {
  EmployeeSubSidebar, EmployeeTaskForm, EmployeeTaskTile,
} from '../verticals/Employees';

import {
  ClientSubSidebar, ClientTaskForm, ClientTaskTile,
} from '../verticals/Clients';
```

---

## Step 5 — Update `src/App.jsx` to use barrel imports

REMOVE these individual imports:
```js
import HubManagement from './verticals/ChargingHubs/HubManagement';
import HubFunctionManagement from './verticals/ChargingHubs/HubFunctionManagement';
import DailyTasksManagement from './verticals/ChargingHubs/DailyTasksManagement';
import DepartmentManagement from './verticals/Employees/DepartmentManagement';
import EmployeeRoleManagement from './verticals/Employees/EmployeeRoleManagement';
import ClientCategoryManagement from './verticals/Clients/ClientCategoryManagement';
import ClientBillingModelManagement from './verticals/Clients/ClientBillingModelManagement';
import ClientServiceManagement from './verticals/Clients/ClientServiceManagement';
```

ADD barrel imports:
```js
import {
  HubManagement, HubFunctionManagement, DailyTasksManagement,
} from './verticals/ChargingHubs';

import {
  DepartmentManagement, EmployeeRoleManagement,
} from './verticals/Employees';

import {
  ClientCategoryManagement, ClientBillingModelManagement, ClientServiceManagement,
} from './verticals/Clients';
```

**Note**: `EmployeeManagement` and `ClientManagement` are rendered as children inside
`<VerticalWorkspace>` in App.jsx. Include them in the barrel imports too if they're
imported in App.jsx:
```js
import { EmployeeManagement } from './verticals/Employees';
import { ClientManagement } from './verticals/Clients';
```

---

## Step 6 — Update `src/components/TaskController.jsx`

TaskController imports `TaskCSVDownload` and `TaskCSVImport` from:
```js
import TaskCSVDownload from '../verticals/ChargingHubs/TaskCSVDownload';
import TaskCSVImport from '../verticals/ChargingHubs/TaskCSVImport';
```

Update to use barrel:
```js
import { TaskCSVDownload, TaskCSVImport } from '../verticals/ChargingHubs';
```

---

## Step 7 — Circular Import Safety Check

**IMPORTANT**: Barrel files can create circular imports if any file inside the barrel
imports from the same barrel's index.

Check each vertical folder for internal cross-imports:
```powershell
Get-ChildItem "src/verticals/ChargingHubs" -Filter "*.jsx" | Select-String -Pattern "from './index'"
# Should return ZERO results

Get-ChildItem "src/verticals/Employees" -Filter "*.jsx" | Select-String -Pattern "from './index'"
# Should return ZERO results
```

Components inside the ChargingHubs folder should import EACH OTHER via direct paths:
```js
// CORRECT (inside ChargingHubs folder):
import HubSelector from './HubSelector';

// WRONG (would create circular):
import { HubSelector } from './index';
```

---

## Step 8 — Verification

### 8a. Build
```powershell
npm run build:staging
```

### 8b. Check bundle did not grow significantly
```
Compare the dist/ sizes before and after.
`dist/assets/index-*.js` should not grow by more than 2%.
```

### 8c. Smoke tests
1. Hub Management page loads ✓
2. Hub Function Management loads ✓  
3. Department Management loads ✓
4. Employee Role Management loads ✓
5. Client Category Management loads ✓
6. Client Billing Model Management loads ✓
7. Client Service Management loads ✓
8. TaskCSVDownload and TaskCSVImport buttons work in Hub Task Board ✓

---

## Step 9 — Commit

```powershell
git add src/verticals/ChargingHubs/index.js
git add src/verticals/Employees/index.js
git add src/verticals/Clients/index.js
git add -A
git commit -m "refactor: RB-08 add vertical barrel exports"
```
