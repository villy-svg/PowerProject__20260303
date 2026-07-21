import React from 'react';
import CSVImportButton from '../../components/ui/CSVImportButton';
import { supabase } from '../../services/core/supabaseClient';
import { normalizeValue, calculateSimilarity } from '../../utils/matchingAlgorithms';

/**
 * ClientCategoryCSVImport — Thin Wrapper
 *
 * Defines client category specific import rules.
 */
const ClientCategoryCSVImport = ({ 
  onImportComplete, 
  className, 
  label = 'Import Data',
  tableName = 'client_categories',
  entityName = 'Client Categories',
  requiredFields = ['category_name']
}) => {
  const [importing, setImporting] = React.useState(false);
  const [existingData, setExistingData] = React.useState(null);

  const loadContext = async () => {
    if (existingData) return { existingData };

    const { data, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) throw error;

    setExistingData(data || []);
    return { existingData: data || [] };
  };

  const handleFocus = async () => {
    if (existingData) return;
    setImporting(true);
    try { await loadContext(); } catch (err) { console.error(err); } finally { setImporting(false); }
  };

  const isSoftMatch = (row, existing) => {
    const rowName = normalizeValue(row.category_name || row.service_name || row.name || '');
    const extName = normalizeValue(existing.name);
    return calculateSimilarity(rowName, extName) > 0.92;
  };

  const isHardMatch = (row, existing) => {
    const rowCode = (row.code || '').toUpperCase().trim();
    const extCode = (existing.code || '').toUpperCase().trim();
    if (rowCode && extCode && rowCode === extCode) return true;
    return false;
  };

  const renderConflictTile = (conflict) => (
    <div className="tile-content">
      <div className="u-flex-between u-items-center u-mb-4">
        <h5 className="u-m-0 u-fw-600 u-text-brand-green">
          {conflict.csvRow.category_name || conflict.csvRow.service_name || conflict.csvRow.name}
        </h5>
        {conflict.matchMode === 'hard' && (
          <span className="csv-error-badge">
            Code Match
          </span>
        )}
      </div>
      <p className="u-text-sm u-opacity-70 u-m-0">Code: {conflict.csvRow.code || 'None'}</p>
    </div>
  );

  const handleDataParsed = async (rows) => {
    setImporting(true);
    try {
      const ctx = await loadContext();

      const itemsToUpsert = rows
        .filter(row => (row.category_name || row.service_name || row.name || '').trim())
        .map(row => {
          const name = (row.category_name || row.service_name || row.name || '').trim();
          const possibleMatches = ctx.existingData.filter(e => isHardMatch(row, e) || isSoftMatch(row, e));
          const existingMatch = possibleMatches.find(e => isHardMatch(row, e)) || possibleMatches[0];

          const payload = {
            id: existingMatch?.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
            name,
            code: (row.code || '').toUpperCase().trim() || null,
            description: row.description || null,
            updated_at: new Date().toISOString(),
          };

          // If category, add default_service_code if provided
          if (tableName === 'client_categories' && row.default_service_code) {
            payload.default_service_code = row.default_service_code;
          }

          return payload;
        });

      if (itemsToUpsert.length === 0) throw new Error(`No valid ${entityName} records found.`);

      const { error } = await supabase
        .from(tableName)
        .upsert(itemsToUpsert, { onConflict: 'id' });

      if (error) throw error;

      alert(`Successfully processed ${itemsToUpsert.length} ${entityName}.`);
      setExistingData(null); 
      if (onImportComplete) onImportComplete();
    } catch (err) {
      console.error(`CSV Import Error [${tableName}]:`, err);
      alert(`Import failed: ${err.message || String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <CSVImportButton
      label={importing ? 'Importing...' : label}
      onDataParsed={handleDataParsed}
      requiredFields={requiredFields}
      getConflictKey={(row) => {
        const name = normalizeValue(row.category_name || row.service_name || row.name || '');
        const code = normalizeValue(row.code || '');
        return `${name}|${code}` || 'new-row';
      }}
      findConflict={(row, existingData) => {
        const hard = existingData.find(e => isHardMatch(row, e));
        if (hard) return { existingRecord: hard, matchMode: 'hard' };
        const soft = existingData.find(e => isSoftMatch(row, e));
        if (soft) return { existingRecord: soft, matchMode: 'soft' };
        return null;
      }}
      existingData={existingData}
      renderConflictTile={renderConflictTile}
      entityName={entityName}
      className={className}
      disabled={importing}
      compareFields={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
        { key: 'description', label: 'Description' },
      ]}
      onFocus={handleFocus}
    />
  );
};

export default ClientCategoryCSVImport;
