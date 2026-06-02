import React, { useState, useEffect } from 'react';
import { googleSheetsService } from '../../services/core/googleSheetsService';
import SheetsMapping from './components/SheetsMapping';
import DataGrid from './components/DataGrid';
import { validateRow, validateSheet } from './utils/validationRules';

const DataManagerWorkspace = () => {
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [previewData, setPreviewData] = useState(null);

  // Validation & Edit States
  const [validationErrors, setValidationErrors] = useState({}); // { rowIndex: { colIdx: 'errorMessage' } }
  const [editedCells, setEditedCells] = useState({}); // { rowIndex: { colIdx: 'newValue' } }
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(null);
  const [checkerRun, setCheckerRun] = useState(false);

  // Additional settings once the sheet is loaded
  const [tabSettings, setTabSettings] = useState({
    currentDataTab: 'Current Data',
    currentHeaderTab: 'Current Header',
    vehicleDetailsTab: 'Vehicle Details',
    masterDataTab: 'Master Data'
  });

  const handleSettingChange = (e) => {
    const { name, value } = e.target;
    setTabSettings(prev => ({ ...prev, [name]: value }));
  };

  const extractSpreadsheetId = (url) => {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  // Reset checker/edits when switching tabs
  useEffect(() => {
    setValidationErrors({});
    setEditedCells({});
    setShowErrorsOnly(false);
    setSyncSuccess(null);
    setCheckerRun(false);
  }, [activeTab]);

  // Fetch spreadsheet structure and list of tabs, then load default tab
  const handleLoadSpreadsheet = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPreviewData(null);
    setTabs([]);
    setActiveTab('');

    try {
      const sheetId = extractSpreadsheetId(googleSheetsUrl);
      if (!sheetId) {
        throw new Error('Invalid Google Sheets URL. Make sure it contains a /d/SPREADSHEET_ID/ pattern.');
      }
      
      // 1. Get spreadsheet metadata to discover all tabs
      const metadata = await googleSheetsService.getSpreadsheet(sheetId);
      const sheetList = metadata.sheets || [];
      if (sheetList.length === 0) {
        throw new Error('No sheets or tabs found inside this spreadsheet.');
      }

      const tabNames = sheetList.map(s => s.properties.title);
      setTabs(tabNames);

      // Determine default tab (first available tab)
      const defaultTab = tabNames[0];
      setActiveTab(defaultTab);
      
      // 2. Fetch data for default tab using FORMULA rendering option to read formulae
      const data = await googleSheetsService.readSheet(sheetId, defaultTab, 'FORMULA');
      setPreviewData(data);
    } catch (err) {
      console.error('[DataManager] Load error:', err);
      setError(err.message || 'Failed to connect to Google Sheet. Check permissions and Service Account access.');
    } finally {
      setLoading(false);
    }
  };

  // Dynamically load a different tab on click
  const handleTabChange = async (tabName) => {
    if (tabName === activeTab) return;
    setTabLoading(true);
    setError(null);
    setActiveTab(tabName);

    try {
      const sheetId = extractSpreadsheetId(googleSheetsUrl);
      // Fetch tab values using FORMULA rendering option to see formulae
      const data = await googleSheetsService.readSheet(sheetId, tabName, 'FORMULA');
      setPreviewData(data);
    } catch (err) {
      console.error('[DataManager] Tab read error:', err);
      setError(`Failed to read tab "${tabName}": ${err.message}`);
      setPreviewData(null);
    } finally {
      setTabLoading(false);
    }
  };

  // --- VALIDATION TRIGGERS ---
  const handleRunChecker = () => {
    if (!previewData || previewData.length <= 1) return;

    const headers = previewData[0];
    const errors = validateSheet(previewData.slice(1), headers);

    setValidationErrors(errors);
    setCheckerRun(true);
    setSyncSuccess(null);
  };

  // --- INLINE EDIT HANDLING ---
  const handleCellEdit = (rowIndex, colIdx, newValue) => {
    setEditedCells(prev => {
      const rowEdits = { ...prev[rowIndex], [colIdx]: newValue };
      return { ...prev, [rowIndex]: rowEdits };
    });

    // Recalculate validation for this specific row in real-time
    const headers = previewData[0];
    const originalRow = previewData[rowIndex];
    
    // Construct virtual edited row
    const virtualRow = originalRow.map((cellVal, cIdx) => {
      if (cIdx === colIdx) return newValue;
      if (editedCells[rowIndex] && editedCells[rowIndex][cIdx] !== undefined) {
        return editedCells[rowIndex][cIdx];
      }
      return cellVal;
    });

    const rowErrors = validateRow(virtualRow, headers);

    setValidationErrors(prev => {
      const updated = { ...prev };
      if (rowErrors) {
        updated[rowIndex] = rowErrors;
      } else {
        delete updated[rowIndex];
      }
      return updated;
    });
  };

  // --- BATCH SYNC BACK TO GOOGLE SHEETS ---
  const handleSyncCorrections = async () => {
    const sheetId = extractSpreadsheetId(googleSheetsUrl);
    if (!sheetId || Object.keys(editedCells).length === 0) return;

    setSyncing(true);
    setSyncSuccess(null);
    setError(null);

    try {
      const headers = previewData[0];
      const rowsToUpdate = Object.keys(editedCells);

      // Assemble all updates in one batch payload
      const batchData = rowsToUpdate.map(strRowIndex => {
        const rowIndex = parseInt(strRowIndex, 10);
        const originalRow = previewData[rowIndex];
        
        // Assemble final row values to write
        const updatedRow = originalRow.map((cellVal, cIdx) => {
          if (editedCells[rowIndex] && editedCells[rowIndex][cIdx] !== undefined) {
            return editedCells[rowIndex][cIdx];
          }
          return cellVal;
        });

        // 1-based indexing for sheets range: Headers are row 1, data row idx is rowIndex + 1
        const sheetsRowNumber = rowIndex + 1;
        const endColChar = String.fromCharCode(65 + headers.length - 1);
        const range = `${activeTab}!A${sheetsRowNumber}:${endColChar}${sheetsRowNumber}`;

        return {
          range,
          values: [updatedRow]
        };
      });

      // Execute single batch write request
      const updatedCellsCount = await googleSheetsService.batchUpdateSheet(sheetId, batchData);

      setSyncSuccess(`Successfully updated ${rowsToUpdate.length} row(s) (${updatedCellsCount} cells) in Google Sheets.`);
      
      // Merge edits into previewData
      setPreviewData(prev => {
        const newData = [...prev];
        rowsToUpdate.forEach(strRowIndex => {
          const rowIndex = parseInt(strRowIndex, 10);
          newData[rowIndex] = newData[rowIndex].map((cellVal, cIdx) => {
            if (editedCells[rowIndex] && editedCells[rowIndex][cIdx] !== undefined) {
              return editedCells[rowIndex][cIdx];
            }
            return cellVal;
          });
        });
        return newData;
      });

      // Clear edits state
      setEditedCells({});
    } catch (err) {
      console.error('[DataManager] Batch Sync error:', err);
      setError(`Failed to sync batch updates to Google Sheets: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Determine rows to render based on error filters
  const getRenderRows = () => {
    if (!previewData) return [];
    
    const allDataRows = previewData.slice(1).map((row, idx) => ({
      originalIndex: idx + 1,
      cells: row
    }));

    if (showErrorsOnly) {
      return allDataRows.filter(r => validationErrors[r.originalIndex]);
    }

    return allDataRows; // Show all rows
  };

  const renderRows = getRenderRows();
  const totalErrors = Object.values(validationErrors).reduce((acc, rowErrs) => acc + Object.keys(rowErrs).length, 0);
  const isEditableTab = activeTab === tabSettings.currentDataTab;

  return (
    <div className="workspace-scroll-area">
      <div className="workspace-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Form Section */}
        <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ color: 'var(--brand-mint)', textShadow: '0 0 10px var(--halo-glow)' }}>Data Sheet Board</h2>
            <p style={{ color: 'var(--text-color)', opacity: 0.7 }}>Securely load, validate, correct, and sync vehicle transaction sheets.</p>
          </div>
          
          <form onSubmit={handleLoadSpreadsheet} className="data-sheet-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label>Google Sheets URL</label>
              <div className="form-input-container">
                <input 
                  type="url" 
                  name="googleSheetsUrl"
                  value={googleSheetsUrl}
                  onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  required
                />
              </div>
            </div>

            <div className="form-footer" style={{ border: 'none', background: 'transparent', padding: '10px 0' }}>
              <button 
                type="submit" 
                className="halo-button primary"
                style={{ width: '100%' }}
                disabled={loading || !googleSheetsUrl}
              >
                {loading ? 'Connecting & Loading Spreadsheet...' : 'Load & Preview Spreadsheet'}
              </button>
            </div>
          </form>
        </div>

        {/* Tab Settings Configuration Card */}
        {previewData && !loading && (
          <SheetsMapping tabSettings={tabSettings} onSettingChange={handleSettingChange} />
        )}

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <div className="spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid var(--brand-mint)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
            <p style={{ color: 'var(--text-color)' }}>Retrieving spreadsheet architecture and reading tabs...</p>
            <style>{`
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
          </div>
        )}

        {/* Sync Success & Error Alerts */}
        {syncSuccess && (
          <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', color: '#34d399' }}>
            <strong>Sync Success:</strong> {syncSuccess}
          </div>
        )}

        {error && (
          <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', color: '#f87171' }}>
            <strong>Error:</strong>
            <p style={{ margin: '8px 0 0', fontSize: '14px', lineHeight: '1.5' }}>{error}</p>
          </div>
        )}

        {/* Multi-Tab Data Preview Section */}
        {tabs.length > 0 && (
          <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Sheet Tab Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ color: 'var(--brand-mint)', margin: '0 0 12px 0' }}>Available Sheet Tabs</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {tabs.map((tab) => {
                    const isActive = tab === activeTab;
                    return (
                      <button
                        key={tab}
                        onClick={() => handleTabChange(tab)}
                        className={`halo-button ${isActive ? 'primary' : ''}`}
                        style={{ 
                          padding: '6px 16px', 
                          fontSize: '13px', 
                          height: 'auto',
                          background: isActive ? 'var(--brand-mint)' : 'rgba(255,255,255,0.05)',
                          borderColor: isActive ? 'var(--brand-mint)' : 'var(--border-color)',
                          color: isActive ? '#000' : 'var(--text-color)'
                        }}
                        disabled={tabLoading}
                      >
                        {tab}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons for Validation */}
              {isEditableTab && previewData && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={handleRunChecker}
                    className="halo-button"
                    style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'var(--border-color)', height: '36px', fontSize: '13px' }}
                  >
                    🔍 Run Checker
                  </button>

                  {checkerRun && (
                    <button
                      onClick={() => setShowErrorsOnly(!showErrorsOnly)}
                      className={`halo-button ${showErrorsOnly ? 'primary' : ''}`}
                      style={{ 
                        height: '36px', 
                        fontSize: '13px',
                        background: showErrorsOnly ? '#ef4444' : 'rgba(255,255,255,0.05)',
                        borderColor: showErrorsOnly ? '#ef4444' : 'var(--border-color)',
                        color: showErrorsOnly ? '#fff' : 'var(--text-color)'
                      }}
                    >
                      ⚠️ {showErrorsOnly ? 'Show All Rows' : `Errors Only (${totalErrors})`}
                    </button>
                  )}

                  {Object.keys(editedCells).length > 0 && (
                    <button
                      onClick={handleSyncCorrections}
                      className="halo-button primary"
                      disabled={syncing}
                      style={{ height: '36px', fontSize: '13px', background: 'var(--brand-mint)', color: '#000' }}
                    >
                      {syncing ? 'Syncing...' : `💾 Sync Corrections (${Object.keys(editedCells).length})`}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Table or Inner Loading State */}
            {tabLoading ? (
              <div style={{ textAlign: 'center', padding: '60px' }}>
                <div className="spinner" style={{ border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid var(--brand-mint)', borderRadius: '50%', width: '32px', height: '32px', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }}></div>
                <p style={{ color: 'var(--text-color)', fontSize: '14px', opacity: 0.8 }}>Reading rows from "{activeTab}"...</p>
              </div>
            ) : previewData ? (
              <div>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ color: 'var(--text-color)', opacity: 0.6, margin: 0, fontSize: '13px' }}>
                    {showErrorsOnly 
                      ? `Showing ${renderRows.length} failing records detected in ${activeTab}.`
                      : `Showing ${renderRows.length} records in ${activeTab}.`
                    }
                  </p>
                </div>

                <DataGrid
                  headers={previewData[0]}
                  renderRows={renderRows}
                  validationErrors={validationErrors}
                  editedCells={editedCells}
                  isEditableTab={isEditableTab}
                  onCellEdit={handleCellEdit}
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-color)', opacity: 0.6 }}>
                No preview data loaded for tab "{activeTab}"
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};

export default DataManagerWorkspace;
