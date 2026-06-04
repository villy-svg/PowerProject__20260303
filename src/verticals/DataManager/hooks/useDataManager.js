/**
 * useDataManager.js
 * Custom hook encapsulating ALL business logic for the DataManager vertical.
 *
 * Separating logic from presentation means:
 *  - DataManagerWorkspace.jsx becomes a thin ~50-line orchestrator
 *  - This hook is independently testable without mounting any UI
 *  - State shape and async handlers can evolve without touching JSX
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { googleSheetsService } from '../../../services/core/googleSheetsService';
import { validateRow, validateSheet, cleanEVPlateNumber } from '../utils/validationRules';
import { extractSpreadsheetId, colIndexToLetter, estimateHeaderRowsToSkip } from '../utils/sheetsUtils';

// ─── Default Tab Name Configuration ──────────────────────────────────────────
const DEFAULT_TAB_SETTINGS = {
  currentDataTab:  'Current Data',
  vehicleDetailsTab: 'Vehicle Details',
  masterDataTab:   'Master Data',
  headerRowsToSkip: 0,
};

const sanitizeSpreadsheetData = (data, skip) => {
  if (!data || data.length === 0) return data;
  const headers = data[skip] || [];
  return data.map((row, rIdx) => {
    if (rIdx <= skip || !Array.isArray(row)) return row;
    return row.map((cellVal, cIdx) => {
      const colHeader = (headers[cIdx] || '').toLowerCase().trim();
      
      // 1. Sanitize Excel serialized date numbers
      if (colHeader.includes('date') && cellVal != null && /^\d+$/.test(String(cellVal).trim())) {
        const numVal = parseInt(String(cellVal).trim(), 10);
        if (numVal > 30000 && numVal < 70000) {
          const excelEpoch = new Date(Date.UTC(1899, 11, 30));
          const dateObj = new Date(excelEpoch.getTime() + numVal * 24 * 60 * 60 * 1000);
          if (!isNaN(dateObj.getTime())) {
            return `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
          }
        }
      }

      // 2. Sanitize SoC percentage decimal format (e.g. 0.35 -> 35%, or 35 -> 35%)
      if (colHeader.includes('soc') && cellVal != null) {
        const strVal = String(cellVal).trim();
        if (strVal && !strVal.endsWith('%') && !strVal.startsWith('=')) {
          const num = parseFloat(strVal);
          if (!isNaN(num)) {
            if (num > 0 && num <= 1) {
              return `${Math.round(num * 10000) / 100}%`;
            } else if (num >= 0 && num <= 100) {
              return `${num}%`;
            }
          }
        }
      }

      return cellVal;
    });
  });
};

export const useDataManager = () => {
  // ── Spreadsheet Source ───────────────────────────────────────────────────
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [loading, setLoading]     = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError]         = useState(null);
  const [tabs, setTabs]           = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [previewData, setPreviewData] = useState(null);

  // ── Validation & Edit ────────────────────────────────────────────────────
  /** { rowIndex: { colIdx: 'errorMessage' } } */
  const [validationErrors, setValidationErrors] = useState({});
  /** { rowIndex: { colIdx: 'newValue' } } */
  const [editedCells, setEditedCells] = useState({});
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(null);
  const [checkerRun, setCheckerRun] = useState(false);
  /** Cached Set of valid plate numbers from the Vehicle Details tab */
  const [fleetPlates, setFleetPlates] = useState(null);

  // ── Tab Name Mapping ─────────────────────────────────────────────────────
  const [tabSettings, setTabSettings] = useState(DEFAULT_TAB_SETTINGS);

  // ── Derived Values ───────────────────────────────────────────────────────
  /** Parsed spreadsheet ID — recomputed only when URL changes */
  const sheetId = useMemo(() => extractSpreadsheetId(googleSheetsUrl), [googleSheetsUrl]);

  /** True when the active tab is the editable "Current Data" sheet */
  const isEditableTab = activeTab === tabSettings.currentDataTab;

  /** Total count of individual cell errors across all rows */
  const totalErrors = useMemo(
    () => Object.values(validationErrors).reduce((acc, rowErrs) => acc + Object.keys(rowErrs).length, 0),
    [validationErrors]
  );

  /**
   * Rows to render in the DataGrid — either all rows or error-only filtered.
   * Memoised to avoid recomputing on unrelated state changes.
   */
  const renderRows = useMemo(() => {
    if (!previewData) return [];
    const skip = Math.max(0, parseInt(tabSettings.headerRowsToSkip || 0, 10));
    const allDataRows = previewData.slice(skip + 1).map((row, idx) => ({
      originalIndex: skip + idx + 1,
      cells: row,
    }));
    return showErrorsOnly
      ? allDataRows.filter(r => validationErrors[r.originalIndex])
      : allDataRows;
  }, [previewData, showErrorsOnly, validationErrors, tabSettings.headerRowsToSkip]);

  // ── Side Effects ─────────────────────────────────────────────────────────

  /** Reset checker/edit state whenever the active tab changes */
  useEffect(() => {
    setValidationErrors({});
    setEditedCells({});
    setShowErrorsOnly(false);
    setSyncSuccess(null);
    setCheckerRun(false);
  }, [activeTab]);

  /** Discard stale fleet plates when a new spreadsheet URL is entered */
  useEffect(() => {
    setFleetPlates(null);
  }, [googleSheetsUrl]);

  // ── Settings Handler ─────────────────────────────────────────────────────
  const handleSettingChange = useCallback((e) => {
    const { name, value } = e.target;
    setTabSettings(prev => ({ ...prev, [name]: value }));
  }, []);

  // ── Async: Load Spreadsheet ───────────────────────────────────────────────
  const handleLoadSpreadsheet = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPreviewData(null);
    setTabs([]);
    setActiveTab('');

    try {
      if (!sheetId) {
        throw new Error('Invalid Google Sheets URL. Make sure it contains a /d/SPREADSHEET_ID/ pattern.');
      }

      // 1. Fetch spreadsheet metadata to discover all tabs
      const metadata = await googleSheetsService.getSpreadsheet(sheetId);
      const sheetList = metadata.sheets || [];
      if (sheetList.length === 0) {
        throw new Error('No sheets or tabs found inside this spreadsheet.');
      }

      const tabNames = sheetList.map(s => s.properties.title);
      setTabs(tabNames);

      // 2. Auto-load the first tab using FORMULA rendering to preserve formulae
      const defaultTab = tabNames[0];
      setActiveTab(defaultTab);
      const data = await googleSheetsService.readSheet(sheetId, defaultTab, 'FORMULA');

      // Heuristically auto-estimate skipped rows
      const estimatedSkip = estimateHeaderRowsToSkip(data);
      setTabSettings(prev => ({ ...prev, headerRowsToSkip: estimatedSkip }));

      const sanitized = sanitizeSpreadsheetData(data, estimatedSkip);
      setPreviewData(sanitized);
    } catch (err) {
      console.error('[DataManager] Load error:', err);
      setError(err.message || 'Failed to connect to Google Sheet. Check permissions and Service Account access.');
    } finally {
      setLoading(false);
    }
  }, [sheetId]);

  // ── Async: Switch Tab ─────────────────────────────────────────────────────
  const handleTabChange = useCallback(async (tabName) => {
    if (tabName === activeTab) return;
    setTabLoading(true);
    setError(null);
    setActiveTab(tabName);

    try {
      // FORMULA rendering keeps raw formulae visible for inspection
      const data = await googleSheetsService.readSheet(sheetId, tabName, 'FORMULA');

      // Heuristically auto-estimate skipped rows
      const estimatedSkip = estimateHeaderRowsToSkip(data);
      setTabSettings(prev => ({ ...prev, headerRowsToSkip: estimatedSkip }));

      const sanitized = sanitizeSpreadsheetData(data, estimatedSkip);
      setPreviewData(sanitized);
    } catch (err) {
      console.error('[DataManager] Tab read error:', err);
      setError(`Failed to read tab "${tabName}": ${err.message}`);
      setPreviewData(null);
    } finally {
      setTabLoading(false);
    }
  }, [activeTab, sheetId]);

  // ── Async: Run Validation Checker ─────────────────────────────────────────
  const handleRunChecker = useCallback(async () => {
    let skip = Math.max(0, parseInt(tabSettings.headerRowsToSkip || 0, 10));
    if (!previewData || previewData.length === 0) return;

    // Check if the current skip row has any valid core headers.
    // If not, automatically estimate a better row-skip index to help the user.
    const currentHeaderRow = previewData[skip] || [];
    const hasCoreHeaders = currentHeaderRow.some(cell => {
      const val = String(cell || '').toLowerCase().trim();
      return (
        val.includes('date') ||
        val.includes('plate') ||
        val.includes('vehicle') ||
        val.includes('soc') ||
        val.includes('units') ||
        val.includes('battery')
      );
    });

    if (!hasCoreHeaders) {
      const betterSkip = estimateHeaderRowsToSkip(previewData);
      if (betterSkip !== skip) {
        skip = betterSkip;
        setTabSettings(prev => ({ ...prev, headerRowsToSkip: betterSkip }));
      }
    }

    if (previewData.length <= skip + 1) return;

    // Preserve current plates ref so we can use it even if the fetch fails
    let platesSet = fleetPlates;
    setLoading(true);
    setError(null);

    try {
      // Lazy-load Vehicle Details tab for fleet master cross-reference
      if (!platesSet) {
        const detailsData = await googleSheetsService.readSheet(sheetId, tabSettings.vehicleDetailsTab, 'FORMULA');
        if (detailsData && detailsData.length > 0) {
          const detailsHeaders = detailsData[0];

          // Find the plate/vehicle column — fallback to col 0
          let plateColIdx = detailsHeaders.findIndex(h =>
            (h || '').toLowerCase().trim().includes('plate') ||
            (h || '').toLowerCase().trim().includes('vehicle')
          );
          if (plateColIdx === -1) plateColIdx = 0;

          const parsedPlates = new Set();
          detailsData.slice(1).forEach(row => {
            const plateVal = row[plateColIdx];
            if (plateVal != null && String(plateVal).trim() !== '') {
              parsedPlates.add(cleanEVPlateNumber(String(plateVal)));
            }
          });

          platesSet = parsedPlates;
          setFleetPlates(parsedPlates);
        }
      }
    } catch (err) {
      console.error('[DataManager] Fleet cross-reference load failed:', err);
      setError(
        `Warning: Could not load the "${tabSettings.vehicleDetailsTab}" tab for fleet cross-referencing. ` +
        `The checker will continue without cross-reference checks. Details: ${err.message}`
      );
    } finally {
      setLoading(false);
    }

    // Run validation — even if fleet load failed, run without cross-reference
    const headers = previewData[skip];
    const dataRows = previewData.slice(skip + 1);
    const errors = validateSheet(dataRows, headers, { vehiclePlates: platesSet }, skip);
    setValidationErrors(errors);
    setCheckerRun(true);
    setSyncSuccess(null);
  }, [fleetPlates, previewData, sheetId, tabSettings.vehicleDetailsTab, tabSettings.headerRowsToSkip]);

  // ── Inline Cell Edit ──────────────────────────────────────────────────────
  const handleCellEdit = useCallback((rowIndex, colIdx, newValue) => {
    const skip = Math.max(0, parseInt(tabSettings.headerRowsToSkip || 0, 10));
    const headers = previewData[skip];
    const headerName = (headers[colIdx] || '').toLowerCase().trim();

    // Auto-clean Indian EV plate numbers as the user types
    const isPlateCol = headerName.includes('plate number') || headerName.includes('vehicle number');
    const processedValue = isPlateCol ? cleanEVPlateNumber(newValue) : newValue;

    // Merge edit into editedCells
    setEditedCells(prev => ({
      ...prev,
      [rowIndex]: { ...prev[rowIndex], [colIdx]: processedValue },
    }));

    // Re-validate this row immediately with the new value applied
    const originalRow = previewData[rowIndex];
    const virtualRow = originalRow.map((cellVal, cIdx) => {
      if (cIdx === colIdx) return processedValue;
      return editedCells[rowIndex]?.[cIdx] ?? cellVal;
    });

    const rowErrors = validateRow(virtualRow, headers, { vehiclePlates: fleetPlates });
    setValidationErrors(prev => {
      const updated = { ...prev };
      if (rowErrors) {
        updated[rowIndex] = rowErrors;
      } else {
        delete updated[rowIndex];
      }
      return updated;
    });
  }, [editedCells, fleetPlates, previewData, tabSettings.headerRowsToSkip]);

  // ── Async: Batch Sync to Google Sheets ───────────────────────────────────
  const handleSyncCorrections = useCallback(async () => {
    if (!sheetId || Object.keys(editedCells).length === 0) return;

    setSyncing(true);
    setSyncSuccess(null);
    setError(null);

    try {
      const skip = Math.max(0, parseInt(tabSettings.headerRowsToSkip || 0, 10));
      const headers = previewData[skip];

      if (!headers || headers.length === 0) {
        throw new Error('Cannot sync — header row not found. Re-load the spreadsheet and try again.');
      }

      const rowsToUpdate = Object.keys(editedCells);

      // Build batch payload — one entry per edited row.
      // Guard against stale editedCells entries that point to rows that no longer exist
      // in previewData (e.g. after a tab switch or partial reload).
      const batchData = [];
      const staleRows = [];

      rowsToUpdate.forEach(strRowIndex => {
        const rowIndex = parseInt(strRowIndex, 10);
        const originalRow = previewData[rowIndex];

        if (!originalRow) {
          // This editedCells entry is stale — the row no longer exists in the current previewData.
          // Log it and skip rather than crashing.
          staleRows.push(rowIndex);
          console.warn(`[DataManager] Sync skipping stale row index ${rowIndex} — no matching previewData row.`);
          return;
        }

        // Merge edits over originals, padding short rows to header length
        const updatedRow = headers.map((_, cIdx) => {
          if (editedCells[rowIndex]?.[cIdx] !== undefined) return editedCells[rowIndex][cIdx];
          const cellVal = originalRow[cIdx];
          return cellVal != null ? cellVal : '';
        });

        // Sheets API uses 1-based row numbers (header = row 1, data starts at row 2)
        const sheetsRowNumber = rowIndex + 1;
        const endColLetter = colIndexToLetter(headers.length - 1);
        const range = `${activeTab}!A${sheetsRowNumber}:${endColLetter}${sheetsRowNumber}`;

        batchData.push({ range, values: [updatedRow] });
      });

      if (batchData.length === 0) {
        throw new Error(
          `Nothing to sync — all ${staleRows.length} pending edit(s) pointed to rows that are no longer present. ` +
          `Re-load the spreadsheet to refresh the data, then re-apply your corrections.`
        );
      }

      const updatedCellsCount = await googleSheetsService.batchUpdateSheet(sheetId, batchData);
      const syncedRows = rowsToUpdate.length - staleRows.length;
      setSyncSuccess(
        `Successfully updated ${syncedRows} row(s) (${updatedCellsCount} cells) in Google Sheets.` +
        (staleRows.length > 0 ? ` (${staleRows.length} stale row(s) were skipped — re-load to refresh.)` : '')
      );

      // Commit edits into the local preview data so the grid reflects the saved state.
      // Guard against undefined rows in case previewData changed since editedCells was built.
      setPreviewData(prev => {
        const next = [...prev];
        rowsToUpdate.forEach(strRowIndex => {
          const rowIndex = parseInt(strRowIndex, 10);
          if (!next[rowIndex]) return; // skip stale rows
          next[rowIndex] = next[rowIndex].map((cellVal, cIdx) =>
            editedCells[rowIndex]?.[cIdx] !== undefined ? editedCells[rowIndex][cIdx] : cellVal
          );
        });
        return next;
      });

      setEditedCells({});
    } catch (err) {
      console.error('[DataManager] Batch sync error:', err);
      setError(`Failed to sync batch updates to Google Sheets: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }, [activeTab, editedCells, previewData, sheetId, tabSettings.headerRowsToSkip]);

  // ── Action: Autofix entire column for suggestion errors ───────────────────
  const handleAutofixColumn = useCallback((colIdx) => {
    if (!previewData) return;
    const skip = Math.max(0, parseInt(tabSettings.headerRowsToSkip || 0, 10));
    const newEdits = { ...editedCells };
    let fixCount = 0;

    Object.keys(validationErrors).forEach(strRowIndex => {
      const rowIndex = parseInt(strRowIndex, 10);
      const rowErrs = validationErrors[rowIndex];
      const cellError = rowErrs?.[colIdx];
      if (cellError && cellError.suggestedValue !== undefined) {
        newEdits[rowIndex] = {
          ...newEdits[rowIndex],
          [colIdx]: cellError.suggestedValue
        };
        fixCount++;
      }
    });

    if (fixCount > 0) {
      setEditedCells(newEdits);

      // Re-validate the entire sheet with the updated editedCells applied
      const updatedPreviewData = previewData.map((row, rIdx) => {
        if (newEdits[rIdx]) {
          const originalRow = previewData[rIdx];
          return originalRow.map((val, cIdx) => newEdits[rIdx][cIdx] !== undefined ? newEdits[rIdx][cIdx] : val);
        }
        return row;
      });

      const headers = previewData[skip];
      const dataRows = updatedPreviewData.slice(skip + 1);
      const errors = validateSheet(dataRows, headers, { vehiclePlates: fleetPlates }, skip);
      setValidationErrors(errors);
      setSyncSuccess(null);
    }
  }, [editedCells, validationErrors, previewData, tabSettings.headerRowsToSkip, fleetPlates]);

  // ── Toggle: Error-only filter ─────────────────────────────────────────────
  const handleToggleErrorsOnly = useCallback(() => {
    setShowErrorsOnly(prev => !prev);
  }, []);

  const headers = useMemo(() => {
    if (!previewData) return [];
    const skip = Math.max(0, parseInt(tabSettings.headerRowsToSkip || 0, 10));
    return previewData[skip] || [];
  }, [previewData, tabSettings.headerRowsToSkip]);

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    // State
    googleSheetsUrl,
    setGoogleSheetsUrl,
    loading,
    tabLoading,
    error,
    tabs,
    activeTab,
    previewData,
    validationErrors,
    editedCells,
    showErrorsOnly,
    syncing,
    syncSuccess,
    checkerRun,
    tabSettings,
    // Derived
    sheetId,
    isEditableTab,
    totalErrors,
    renderRows,
    headers,
    // Handlers
    handleSettingChange,
    handleLoadSpreadsheet,
    handleTabChange,
    handleRunChecker,
    handleCellEdit,
    handleSyncCorrections,
    handleToggleErrorsOnly,
    handleAutofixColumn,
  };
};
