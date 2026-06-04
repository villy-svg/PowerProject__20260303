/**
 * SpreadsheetForm.jsx
 * Presentational card that collects the Google Sheets URL and triggers load.
 * Fully stateless — all state is owned by useDataManager via the parent.
 */

import React from 'react';

const SpreadsheetForm = ({ googleSheetsUrl, onUrlChange, onSubmit, loading, canLoad = true }) => (
  <div className="dm-card">
    <div className="dm-card__header">
      <h2 className="dm-card__title">Data Sheet Board</h2>
      <p className="dm-card__description">
        Securely load, validate, correct, and sync vehicle transaction sheets.
      </p>
    </div>

    <form onSubmit={onSubmit} className="dm-form">
      <div className="form-group">
        <label htmlFor="googleSheetsUrl">Google Sheets URL</label>
        <div className="form-input-container">
          <input
            id="googleSheetsUrl"
            type="url"
            name="googleSheetsUrl"
            value={googleSheetsUrl}
            onChange={onUrlChange}
            placeholder="https://docs.google.com/spreadsheets/d/.../edit"
            required
          />
        </div>
      </div>

      <div className="dm-form-footer">
        <button
          type="submit"
          className="halo-button primary dm-form-submit"
          disabled={loading || !googleSheetsUrl || !canLoad}
          title={!canLoad ? 'Contributor access or higher is required to load sheets' : ''}
        >
          {loading ? 'Connecting & Loading Spreadsheet...' : 'Load & Preview Spreadsheet'}
        </button>
        {/* RBAC notice: shown to Viewer-only users who cannot trigger a load */}
        {!canLoad && (
          <p className="dm-access-notice">
            🔒 Contributor access or higher is required to load &amp; preview sheets.
          </p>
        )}
      </div>
    </form>
  </div>
);

export default SpreadsheetForm;
