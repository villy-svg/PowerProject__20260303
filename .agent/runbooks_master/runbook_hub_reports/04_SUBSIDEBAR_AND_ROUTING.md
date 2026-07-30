# Runbook 04: Sub-Sidebar & Routing — Hub Daily Shift Reports

## 1. Objective

Wire the `hub_reports` board key into the DataManager navigation shell so that clicking "Hub Shift Reports" in the sub-sidebar renders the `<HubReportsBoard />` component inside `DataManagerWorkspace`. This runbook also covers the `npm install recharts` dependency needed for Phase 8 (Analytics Dashboard).

After this phase:
- Navigating to Data Manager → Hub Shift Reports renders the board.
- The board is conditionally imported and rendered by `DataManagerWorkspace` (same pattern as `ModelVerificationForm`).
- `HubReportsBoard` is exported from `DataManagerWorkspace`'s index barrel.
- `recharts` is installed and available for the analytics phase.

> [!NOTE]
> `ContentRouter.jsx` does **NOT** need modification. It already routes the `DATA_MANAGER` vertical to `<DataManagerWorkspace activeVertical={activeVertical} />`. The `hub_reports` board is rendered as a new conditional branch **inside** `DataManagerWorkspace`, following the exact same pattern as `model_verification_board` on line 41.

---

## 2. Prerequisites

- [ ] Phase 1 (Database Schema) complete.
- [ ] Phase 2 (RBAC) complete — `hub_reports` normalises to `DATA_MANAGER` vertical.
- [ ] Phase 3 (Service Layer) complete — `hubReportService.js` exists.
- [ ] The `HubReportsBoard` component file exists at `src/verticals/DataManager/components/HubReportsBoard.jsx` (created in a separate Phase 5 runbook).
- [ ] Node.js and npm are available in the project.
- [ ] You have read the **Safe Code Modification** skill before editing any existing file.

---

## 3. Files Affected

| Action | Path |
| :----- | :--- |
| MODIFY | `src/verticals/DataManager/DataManagerWorkspace.jsx` |
| MODIFY | `src/verticals/DataManager/index.js` |
| RUN    | `npm install recharts` (in project root) |
| NO CHANGE | `src/verticals/DataManager/DataManagerSubSidebar.jsx` (done in Phase 2) |
| NO CHANGE | `src/app/shells/ContentRouter.jsx` |

---

## 4. Implementation Steps

### 4.1 — Install `recharts` Dependency

recharts is NOT currently installed. It is required for the Phase 8 analytics charts (`<LineChart>`, `<BarChart>`, `<Tooltip>`, etc.).

Run in the project root:

```bash
npm install recharts
```

Verify it was added to `package.json`:

```bash
grep '"recharts"' package.json
# Expected: "recharts": "^2.x.x" (or similar)
```

> [!IMPORTANT]
> Install recharts **before** implementing the analytics component. If a developer imports recharts before it's installed, the Vite dev server will throw a `Cannot find module 'recharts'` error that can be hard to diagnose.

---

### 4.2 — MODIFY `src/verticals/DataManager/DataManagerWorkspace.jsx`

Add the `HubReportsBoard` import and a new conditional branch for `activeVertical === 'hub_reports'`. This mirrors the exact pattern used for `model_verification_board`.

**BEFORE** (lines 17–23 — imports section):
```jsx
import React from 'react';
import { useDataManager } from './hooks/useDataManager';
import SpreadsheetForm from './components/SpreadsheetForm';
import SheetsMapping from './components/SheetsMapping';
import SheetTabPanel from './components/SheetTabPanel';
import ModelVerificationForm from './components/ModelVerificationForm';
import './DataManager.css';
```

**AFTER**:
```jsx
import React from 'react';
import { useDataManager } from './hooks/useDataManager';
import SpreadsheetForm from './components/SpreadsheetForm';
import SheetsMapping from './components/SheetsMapping';
import SheetTabPanel from './components/SheetTabPanel';
import ModelVerificationForm from './components/ModelVerificationForm';
import HubReportsBoard from './components/HubReportsBoard'; // <--- ADD
import './DataManager.css';
```

**BEFORE** (lines 41–49 — `model_verification_board` branch):
```jsx
  if (activeVertical === 'model_verification_board') {
    return (
      <div className="dm-scroll-area">
        <div className="dm-workspace">
          <ModelVerificationForm />
        </div>
      </div>
    );
  }
```

**AFTER** (add the new branch immediately below the model_verification_board block):
```jsx
  if (activeVertical === 'model_verification_board') {
    return (
      <div className="dm-scroll-area">
        <div className="dm-workspace">
          <ModelVerificationForm />
        </div>
      </div>
    );
  }

  // Hub Shift Reports board — Maker-Checker workflow
  if (activeVertical === 'hub_reports') {
    return (
      <div className="dm-scroll-area">
        <div className="dm-workspace">
          <HubReportsBoard permissions={permissions} />
        </div>
      </div>
    );
  }
```

> [!IMPORTANT]
> Pass `permissions` down to `HubReportsBoard`. The board needs to distinguish between `canSubmitHubReports` (Maker) and `canVerifyHubReports` (Checker) to render the correct form variant. Do NOT omit this prop.

#### Complete Updated `DataManagerWorkspace.jsx` for Reference

```jsx
/**
 * DataManagerWorkspace.jsx
 *
 * Thin orchestrator — owns no state or business logic.
 * All state and handlers are provided by useDataManager().
 * UI sections are delegated to focused sub-components.
 *
 * Render order:
 *   1. SpreadsheetForm      — URL input card
 *   2. SheetsMapping        — tab name configuration (shown after first load)
 *   3. Loading spinner      — full-page, only during initial load / checker fetch
 *   4. Sync success alert   — confirmation after a batch sync
 *   5. Error alert          — any load / sync / checker error
 *   6. SheetTabPanel        — tab switcher + data grid (shown once tabs are discovered)
 *
 * Board routing (via activeVertical prop):
 *   'DATA_MANAGER'              → Data Sheet Board (default)
 *   'model_verification_board'  → ModelVerificationForm
 *   'hub_reports'               → HubReportsBoard
 */

import React from 'react';
import { useDataManager } from './hooks/useDataManager';
import SpreadsheetForm from './components/SpreadsheetForm';
import SheetsMapping from './components/SheetsMapping';
import SheetTabPanel from './components/SheetTabPanel';
import ModelVerificationForm from './components/ModelVerificationForm';
import HubReportsBoard from './components/HubReportsBoard';
import './DataManager.css';

const DataManagerWorkspace = ({ permissions = {}, activeVertical }) => {
  const dm = useDataManager(activeVertical);

  // RBAC guard: Viewer+ required to see the Data Manager at all.
  // canRead is true for viewer, contributor, editor, and admin.
  if (!permissions.canRead) {
    return (
      <div className="dm-workspace">
        <div className="dm-alert dm-alert--error">
          <strong>Access Denied:</strong>
          <p>You do not have permission to view the Data Manager.</p>
        </div>
      </div>
    );
  }

  if (activeVertical === 'model_verification_board') {
    return (
      <div className="dm-scroll-area">
        <div className="dm-workspace">
          <ModelVerificationForm />
        </div>
      </div>
    );
  }

  // Hub Shift Reports board — Maker-Checker workflow
  if (activeVertical === 'hub_reports') {
    return (
      <div className="dm-scroll-area">
        <div className="dm-workspace">
          <HubReportsBoard permissions={permissions} />
        </div>
      </div>
    );
  }

  return (
    <div className="dm-scroll-area">
      <div className="dm-workspace">

        {/* 1 —— URL Input Form ——————————————————————————————————————————— */}
        {/* canCreate (Contributor+) is required to load and preview sheets  */}
        <SpreadsheetForm
          title={activeVertical === 'model_verification_board' ? 'Model Verification Board' : 'Data Sheet Board'}
          googleSheetsUrl={dm.googleSheetsUrl}
          onUrlChange={(e) => dm.setGoogleSheetsUrl(e.target.value)}
          onSubmit={dm.handleLoadSpreadsheet}
          loading={dm.loading}
          canLoad={!!permissions.canCreate}
        />

        {/* 2 —— Tab Name Mapping (visible after spreadsheet loads) ————————— */}
        {dm.previewData && !dm.loading && (
          <SheetsMapping
            tabSettings={dm.tabSettings}
            onSettingChange={dm.handleSettingChange}
          />
        )}

        {/* 3 —— Full-Page Loader (initial load + checker cross-ref fetch) —— */}
        {dm.loading && (
          <div className="dm-spinner-wrap">
            <div className="dm-spinner" />
            <p className="dm-spinner-text">
              Retrieving spreadsheet architecture and reading tabs...
            </p>
          </div>
        )}

        {/* 4 —— Sync Success Confirmation ————————————————————————————————— */}
        {dm.syncSuccess && (
          <div className="dm-alert dm-alert--success">
            <strong>Sync Success:</strong> {dm.syncSuccess}
          </div>
        )}

        {/* 5 —— Error Banner ——————————————————————————————————————————————— */}
        {dm.error && (
          <div className="dm-alert dm-alert--error">
            <strong>Error:</strong>
            <p>{dm.error}</p>
          </div>
        )}

        {/* 6 —— Tab Switcher + Data Grid ——————————————————————————————————— */}
        {dm.tabs.length > 0 && (
          <SheetTabPanel
            tabs={dm.tabs}
            activeTab={dm.activeTab}
            tabLoading={dm.tabLoading}
            onTabChange={dm.handleTabChange}
            isEditableTab={dm.isEditableTab}
            previewData={dm.previewData}
            checkerRun={dm.checkerRun}
            totalErrors={dm.totalErrors}
            showErrorsOnly={dm.showErrorsOnly}
            onToggleErrorsOnly={dm.handleToggleErrorsOnly}
            editedCells={dm.editedCells}
            syncing={dm.syncing}
            onRunChecker={dm.handleRunChecker}
            onSyncCorrections={dm.handleSyncCorrections}
            renderRows={dm.renderRows}
            validationErrors={dm.validationErrors}
            headers={dm.headers}
            onCellEdit={dm.handleCellEdit}
            onAutofixColumn={dm.handleAutofixColumn}
            canRunChecker={!!permissions.canUpdate}
            activeVertical={activeVertical}
            scrapingProgress={dm.scrapingProgress}
            onRunScraper={dm.handleRunWebScraper}
          />
        )}

      </div>
    </div>
  );
};

export default DataManagerWorkspace;
```

---

### 4.3 — MODIFY `src/verticals/DataManager/index.js`

Add the `HubReportsBoard` export to the barrel file.

**BEFORE** (full current file — 3 lines):
```javascript
export { default as DataManagerSubSidebar } from './DataManagerSubSidebar';
export { default as DataManagerWorkspace } from './DataManagerWorkspace';
```

**AFTER**:
```javascript
export { default as DataManagerSubSidebar } from './DataManagerSubSidebar';
export { default as DataManagerWorkspace } from './DataManagerWorkspace';
export { default as HubReportsBoard } from './components/HubReportsBoard'; // <--- ADD
```

> [!NOTE]
> This export is not strictly required for Phase 4 to function (the import in `DataManagerWorkspace.jsx` is direct). It is added here for completeness — any future consumer (e.g., a modal or a route outside DataManager) can import `HubReportsBoard` cleanly from the barrel.

---

### 4.4 — ContentRouter.jsx: NO CHANGE REQUIRED

The existing routing in `ContentRouter.jsx` passes `activeVertical` to `DataManagerWorkspace`:

```jsx
// ContentRouter.jsx — existing code, no change needed:
{activeVertical?.startsWith('DATA_MANAGER') || activeVertical === 'model_verification_board' || ... ? (
  <DataManagerWorkspace permissions={permissions} activeVertical={activeVertical} />
) : ...}
```

> [!IMPORTANT]
> Verify that `ContentRouter.jsx` passes `hub_reports` to `DataManagerWorkspace`. If the ContentRouter's conditional uses a whitelist of board keys, add `'hub_reports'` to that list. If it uses a vertical ID prefix check (e.g., `rootVerticalId === DATA_MANAGER_ID`), no change is needed since Phase 2 normalises `hub_reports` to the `DATA_MANAGER` vertical.
>
> Check the actual condition in `ContentRouter.jsx` and confirm `hub_reports` will be routed correctly. This is a **critical verification step**.

---

## 5. Placeholder Component for `HubReportsBoard`

Before Phase 5 (UI implementation), create a minimal placeholder to prevent import errors:

**File**: `src/verticals/DataManager/components/HubReportsBoard.jsx`

```jsx
/**
 * HubReportsBoard.jsx — PLACEHOLDER
 * Full implementation: see Phase 5 runbook.
 */
import React from 'react';

const HubReportsBoard = ({ permissions }) => {
  return (
    <div style={{ padding: '2rem', color: 'var(--text-primary)' }}>
      <h2>Hub Shift Reports</h2>
      <p style={{ color: 'var(--text-secondary)' }}>
        Board coming soon — implementation in Phase 5.
      </p>
      <pre style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
        {JSON.stringify({
          canSubmit: permissions?.canSubmitHubReports,
          canVerify: permissions?.canVerifyHubReports,
        }, null, 2)}
      </pre>
    </div>
  );
};

export default HubReportsBoard;
```

This placeholder verifies the full routing chain (navigation → board rendered) without requiring the full UI to be complete.

---

## 6. Validation Steps

### 6.1 Navigation Flow Verification

1. Start the dev server: `npm run dev`
2. Log in as a user with `DATA_MANAGER` access.
3. Navigate to the **Data Manager** vertical.
4. Confirm three buttons appear in the sub-sidebar:
   - "Data Sheet Board" (existing)
   - "Model Verification Board" (existing)
   - "Hub Shift Reports" (new)
5. Click "Hub Shift Reports".
6. Confirm the URL/state shows `activeVertical = 'hub_reports'`.
7. Confirm the placeholder `<HubReportsBoard />` renders (shows "Board coming soon").
8. Click "Data Sheet Board" — confirm it switches back to the spreadsheet view.
9. Click "Model Verification Board" — confirm it shows `<ModelVerificationForm />`.

### 6.2 RBAC Guard Verification

1. Log in as a user with NO `DATA_MANAGER` access.
2. Confirm "Hub Shift Reports" does NOT appear in the sub-sidebar.
3. Log in as a `DATA_MANAGER` viewer.
4. Confirm "Hub Shift Reports" IS visible (canAccessHubReports = true for viewers).
5. Confirm the placeholder renders — but in Phase 5 the submit button will be hidden for viewers.

### 6.3 Recharts Installation Verification

```bash
node -e "require('recharts'); console.log('recharts OK')"
# Expected: recharts OK
```

Or check the node_modules directory:
```bash
ls node_modules | grep recharts
# Expected: recharts
```

### 6.4 Import Chain Verification

Confirm the following import chain resolves without errors:
- `DataManagerWorkspace.jsx` → `import HubReportsBoard from './components/HubReportsBoard'`
- `index.js` → `export { default as HubReportsBoard } from './components/HubReportsBoard'`
- No circular imports (HubReportsBoard should NOT import from DataManagerWorkspace).

---

## 7. Troubleshooting & Gotchas

| Issue | Potential Cause | Fix |
| :--- | :--- | :--- |
| Clicking "Hub Shift Reports" shows Data Sheet Board | `ContentRouter.jsx` does not route `hub_reports` to `DataManagerWorkspace` | Check the ContentRouter conditional and add `'hub_reports'` if needed. |
| White screen on navigation to `hub_reports` | `HubReportsBoard.jsx` does not exist | Create the placeholder file from Section 5 above. |
| "Hub Shift Reports" sub-sidebar button missing | Phase 2 (RBAC) not complete | Run Phase 2 first — button guard depends on `permissions?.canAccessHubReports`. |
| recharts import error in analytics component | `npm install recharts` not run | Run `npm install recharts` and restart the dev server. |
| `permissions` is undefined in HubReportsBoard | `permissions` prop not passed from DataManagerWorkspace | Verify `<HubReportsBoard permissions={permissions} />` in DataManagerWorkspace. |
| All three sub-sidebar buttons visible even with no access | Guard logic inverted | `permissions?.canAccessHubReports !== false` evaluates to `true` if `canAccessHubReports` is `undefined`. Ensure RBAC correctly sets the flag to `false` (not `undefined`) for users without access. |

---

## 8. Rollback Plan

If regressions are introduced by this phase:

1. **Revert `DataManagerWorkspace.jsx`**: Remove the `HubReportsBoard` import (line added in 4.2) and the `hub_reports` conditional branch (lines added in 4.2).
2. **Revert `index.js`**: Remove the `HubReportsBoard` export line.
3. **Keep `recharts`**: Removing it is not necessary — it won't cause errors if unused. But if needed: `npm uninstall recharts`.
4. Do NOT revert `DataManagerSubSidebar.jsx` changes here — those are tracked in Phase 2's rollback.
5. Reload the dev server.

No database changes are involved in this phase.

---

## 9. Phase Summary: Full Routing Chain

```
User clicks "Hub Shift Reports" in sub-sidebar
    ↓
DataManagerSubSidebar → setActiveVertical('hub_reports')
    ↓
App.jsx re-renders → useRBAC computes permissions
    → rootVerticalId = DATA_MANAGER (Phase 2 normalisation)
    ↓
ContentRouter.jsx routes DATA_MANAGER vertical
    → renders <DataManagerWorkspace activeVertical="hub_reports" permissions={...} />
    ↓
DataManagerWorkspace.jsx checks activeVertical
    → 'hub_reports' branch matched
    → renders <HubReportsBoard permissions={permissions} />
    ↓
HubReportsBoard renders (placeholder → full UI in Phase 5)
```

---

## 10. Progress Tracking

- [ ] Step 4.1: `npm install recharts` complete and verified.
- [ ] Step 4.2: `DataManagerWorkspace.jsx` — `HubReportsBoard` import added.
- [ ] Step 4.2: `DataManagerWorkspace.jsx` — `hub_reports` conditional branch added.
- [ ] Step 4.3: `index.js` — `HubReportsBoard` export added.
- [ ] Step 5: Placeholder `HubReportsBoard.jsx` created (if Phase 5 not yet complete).
- [ ] Step 6.1: Navigation flow verified end-to-end.
- [ ] Step 6.2: RBAC guard verified (board hidden for unauthorised users).
- [ ] Step 6.3: recharts installation confirmed.
- [ ] Step 6.4: ContentRouter routing confirmed.

**Next Runbook**: `05_MAKER_FORM_UI.md` (Phase 5 — Hub Reports submission form for operators)
