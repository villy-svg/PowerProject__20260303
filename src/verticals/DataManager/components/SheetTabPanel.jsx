/**
 * SheetTabPanel.jsx
 * Renders the full tab-switcher card including:
 *   - Sheet tab buttons (top row)
 *   - Checker / filter / sync action toolbar (top-right)
 *   - Tab-switch loading spinner
 *   - DataGrid or empty state
 *
 * Fully presentational — receives all state and handlers via props from the workspace.
 */

import React from 'react';
import DataGrid from './DataGrid';
import { IconCopy } from '../../../components/Icons';

// ─── Tab Switcher ─────────────────────────────────────────────────────────────
const TabList = ({ tabs, activeTab, tabLoading, onTabChange }) => (
  <div>
    <h3 className="dm-tab-bar__title">Available Sheet Tabs</h3>
    <div className="dm-tab-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {tabs.map(tab => (
        <div key={tab} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => onTabChange(tab)}
            className={`halo-button dm-tab-btn ${tab === activeTab ? 'dm-tab-btn--active' : 'dm-tab-btn--inactive'}`}
            disabled={tabLoading}
            style={{ margin: 0 }}
          >
            {tab}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(tab);
            }}
            title={`Copy tab name "${tab}"`}
            className="halo-button dm-copy-btn"
          >
            <IconCopy size={16} />
          </button>
        </div>
      ))}
    </div>
  </div>
);

// ─── Checker Toolbar ────────────────────────────────────────────────
const CheckerToolbar = ({
  onRunChecker,
  checkerRun,
  totalErrors,
  showErrorsOnly,
  onToggleErrorsOnly,
  editedCells,
  syncing,
  onSyncCorrections,
  // canRunChecker: Editor+ is required to run the validation checker
  canRunChecker,
}) => (
  <div className="dm-action-row">
    {/* RBAC: Run Checker requires Editor+ (canUpdate). Show disabled notice to lower roles. */}
    {canRunChecker ? (
      <button onClick={onRunChecker} className="halo-button dm-action-btn">
        🔍 Run Checker
      </button>
    ) : (
      <span className="dm-access-notice" title="Editor access or higher is required">
        🔒 Editor access required to run the checker
      </span>
    )}

    {checkerRun && (
      <button
        onClick={onToggleErrorsOnly}
        className={`halo-button dm-action-btn${showErrorsOnly ? ' dm-action-btn--errors-active' : ''}`}
      >
        ⚠️ {showErrorsOnly ? 'Show All Rows' : `Errors Only (${totalErrors})`}
      </button>
    )}

    {Object.keys(editedCells).length > 0 && (
      <button
        onClick={onSyncCorrections}
        className="halo-button dm-action-btn dm-action-btn--sync"
        disabled={syncing}
      >
        {syncing ? 'Syncing...' : `💾 Sync Corrections (${Object.keys(editedCells).length})`}
      </button>
    )}
  </div>
);

// ─── Data Body (spinner / grid / empty) ──────────────────────────────────────
const DataBody = ({
  tabLoading,
  previewData,
  activeTab,
  renderRows,
  showErrorsOnly,
  validationErrors,
  editedCells,
  isEditableTab,
  headers,
  onCellEdit,
  onAutofixColumn,
}) => {
  if (tabLoading) {
    return (
      <div className="dm-spinner-wrap dm-spinner-wrap--inline">
        <div className="dm-spinner dm-spinner--sm" />
        <p className="dm-spinner-text">Reading rows from &quot;{activeTab}&quot;...</p>
      </div>
    );
  }

  if (!previewData) {
    return (
      <div className="dm-empty-tab">
        No preview data loaded for tab &quot;{activeTab}&quot;
      </div>
    );
  }

  return (
    <div>
      <p className="dm-row-count">
        {showErrorsOnly
          ? `Showing ${renderRows.length} failing records detected in ${activeTab}.`
          : `Showing ${renderRows.length} records in ${activeTab}.`}
      </p>
      <DataGrid
        headers={headers}
        renderRows={renderRows}
        validationErrors={validationErrors}
        editedCells={editedCells}
        isEditableTab={isEditableTab}
        onCellEdit={onCellEdit}
        onAutofixColumn={onAutofixColumn}
      />
    </div>
  );
};

// ─── Composed Panel ───────────────────────────────────────────────────────────
const SheetTabPanel = ({
  tabs,
  activeTab,
  tabLoading,
  onTabChange,
  isEditableTab,
  previewData,
  checkerRun,
  totalErrors,
  showErrorsOnly,
  onToggleErrorsOnly,
  editedCells,
  syncing,
  onRunChecker,
  onSyncCorrections,
  renderRows,
  validationErrors,
  headers,
  onCellEdit,
  onAutofixColumn,
  // canRunChecker: Editor+ is required to see/use the Run Checker button
  canRunChecker = false,
}) => (
  <div className="dm-card dm-card--tab-panel">
    <div className="dm-tab-bar">
      <TabList
        tabs={tabs}
        activeTab={activeTab}
        tabLoading={tabLoading}
        onTabChange={onTabChange}
      />

      {/* Checker toolbar only appears on the editable Current Data tab */}
      {isEditableTab && previewData && (
        <CheckerToolbar
          onRunChecker={onRunChecker}
          checkerRun={checkerRun}
          totalErrors={totalErrors}
          showErrorsOnly={showErrorsOnly}
          onToggleErrorsOnly={onToggleErrorsOnly}
          editedCells={editedCells}
          syncing={syncing}
          onSyncCorrections={onSyncCorrections}
          canRunChecker={canRunChecker}
        />
      )}
    </div>

    <DataBody
      tabLoading={tabLoading}
      previewData={previewData}
      activeTab={activeTab}
      renderRows={renderRows}
      showErrorsOnly={showErrorsOnly}
      validationErrors={validationErrors}
      editedCells={editedCells}
      isEditableTab={isEditableTab}
      headers={headers}
      onCellEdit={onCellEdit}
      onAutofixColumn={onAutofixColumn}
    />
  </div>
);

export default SheetTabPanel;
