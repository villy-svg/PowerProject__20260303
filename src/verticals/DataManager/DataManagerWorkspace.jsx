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
 */

import React from 'react';
import { useDataManager } from './hooks/useDataManager';
import SpreadsheetForm from './components/SpreadsheetForm';
import SheetsMapping from './components/SheetsMapping';
import SheetTabPanel from './components/SheetTabPanel';
import './DataManager.css';

const DataManagerWorkspace = ({ permissions = {} }) => {
  const dm = useDataManager();

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

  return (
    <div className="dm-scroll-area">
      <div className="dm-workspace">

        {/* 1 ── URL Input Form ─────────────────────────────────────────── */}
        {/* canCreate (Contributor+) is required to load and preview sheets  */}
        <SpreadsheetForm
          googleSheetsUrl={dm.googleSheetsUrl}
          onUrlChange={(e) => dm.setGoogleSheetsUrl(e.target.value)}
          onSubmit={dm.handleLoadSpreadsheet}
          loading={dm.loading}
          canLoad={!!permissions.canCreate}
        />

        {/* 2 ── Tab Name Mapping (visible after spreadsheet loads) ──────── */}
        {dm.previewData && !dm.loading && (
          <SheetsMapping
            tabSettings={dm.tabSettings}
            onSettingChange={dm.handleSettingChange}
          />
        )}

        {/* 3 ── Full-Page Loader (initial load + checker cross-ref fetch) ── */}
        {dm.loading && (
          <div className="dm-spinner-wrap">
            <div className="dm-spinner" />
            <p className="dm-spinner-text">
              Retrieving spreadsheet architecture and reading tabs...
            </p>
          </div>
        )}

        {/* 4 ── Sync Success Confirmation ───────────────────────────────── */}
        {dm.syncSuccess && (
          <div className="dm-alert dm-alert--success">
            <strong>Sync Success:</strong> {dm.syncSuccess}
          </div>
        )}

        {/* 5 ── Error Banner ────────────────────────────────────────────── */}
        {dm.error && (
          <div className="dm-alert dm-alert--error">
            <strong>Error:</strong>
            <p>{dm.error}</p>
          </div>
        )}

        {/* 6 ── Tab Switcher + Data Grid ───────────────────────────────── */}
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
          />
        )}

      </div>
    </div>
  );
};

export default DataManagerWorkspace;
