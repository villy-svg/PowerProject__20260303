import React from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/supabaseClient';
import { normalizeValue, calculateSimilarity } from '../../utils/matchingAlgorithms';

/**
 * ClientBillingModelCSVImport — Thin Wrapper
 *
 * Defines billing model specific import rules.
 */
const ClientBillingModelCSVImport = ({ onImportComplete, className, label = 'Import Billing Models' }) => {
  const [importing, setImporting] = React.useState(false);
  const [existingModels, setExistingModels] = React.useState(null);

  const loadContext = async () => {
    if (existingModels) return { existingModels };

    const { data: models, error } = await supabase
      .from('client_billing_models')
      .select('id, name, code');

    if (error) throw error;

    setExistingModels(models || []);
    return { existingModels: models || [] };
  };

  const handleFocus = async () => {
    if (existingModels) return;
    setImporting(true);
    try { await loadContext(); } catch (err) { console.error(err); } finally { setImporting(false); }
  };

  const isSoftMatch = (row, existing) => {
    const rowName = normalizeValue(row.model_name || row.name || '');
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h5 style={{ margin: 0, fontWeight: 600, color: 'var(--brand-green)' }}>
          {conflict.csvRow.model_name || conflict.csvRow.name}
        </h5>
        {conflict.matchMode === 'hard' && (
          <span style={{ fontSize: '0.6rem', padding: '2px 6px', background: 'rgba(255,68,68,0.1)', color: '#ff4444', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 800 }}>
            Code Match
          </span>
        )}
      </div>
      <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0 }}>Code: {conflict.csvRow.code || 'None'}</p>
    </div>
  );

  const handleDataParsed = async (rows) => {
    setImporting(true);
    try {
      const ctx = await loadContext();

      const modelsToUpsert = rows
        .filter(row => (row.model_name || row.name || '').trim())
        .map(row => {
          const name = (row.model_name || row.name || '').trim();
          const possibleMatches = ctx.existingModels.filter(e => isHardMatch(row, e) || isSoftMatch(row, e));
          const existingMatch = possibleMatches.find(e => isHardMatch(row, e)) || possibleMatches[0];

          return {
            id: existingMatch?.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
            name,
            code: (row.code || '').toUpperCase().trim() || null,
            description: row.description || null,
            updated_at: new Date().toISOString(),
          };
        });

      if (modelsToUpsert.length === 0) throw new Error('No valid billing model records found.');

      const { error } = await supabase
        .from('client_billing_models')
        .upsert(modelsToUpsert, { onConflict: 'id' });

      if (error) throw error;

      alert(`Successfully processed ${modelsToUpsert.length} billing models.`);
      setExistingModels(null);
      if (onImportComplete) onImportComplete();
    } catch (err) {
      console.error('ClientBillingModelCSVImport: Finalize Error:', err);
      alert(`Import failed: ${err.message || String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <CSVImportButton
      label={importing ? 'Importing...' : label}
      onDataParsed={handleDataParsed}
      requiredFields={['model_name']}
      getConflictKey={(row) => {
        const name = normalizeValue(row.model_name || row.name || '');
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
      existingData={existingModels}
      renderConflictTile={renderConflictTile}
      entityName="Billing Models"
      className={className}
      disabled={importing}
      compareFields={[
        { key: 'name', label: 'Model Name' },
        { key: 'code', label: 'Code' },
        { key: 'description', label: 'Description' },
      ]}
      onFocus={handleFocus}
    />
  );
};

export default ClientBillingModelCSVImport;
