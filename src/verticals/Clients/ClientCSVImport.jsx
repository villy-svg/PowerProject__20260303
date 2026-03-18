import React from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/supabaseClient';
import { normalizeValue, calculateSimilarity } from '../../utils/matchingAlgorithms';

/**
 * ClientCSVImport — Thin Wrapper
 *
 * Defines client-specific import rules:
 *   - Conflict key: poc_email or client name
 *   - Resolves category/billing model codes to IDs before upsert
 *
 * All duplicate detection is handled by CSVImportButton.
 */
const ClientCSVImport = ({ onImportComplete, className, label = 'Import CSV' }) => {
  const [importing, setImporting] = React.useState(false);
  const [existingClients, setExistingClients] = React.useState(null);
  const [lookupMaps, setLookupMaps] = React.useState(null);

  const loadContext = async () => {
    if (existingClients && lookupMaps) return { existingClients, ...lookupMaps };

    const [{ data: cats }, { data: models }, { data: clients }] = await Promise.all([
      supabase.from('client_categories').select('id, name, code'),
      supabase.from('client_billing_models').select('id, name, code'),
      supabase.from('clients').select('id, name, poc_email, poc_phone'),
    ]);

    const createMap = (items, codeKey) => {
      const m = {};
      items?.forEach(item => {
        if (item.id) {
          if (item.name) m[item.name.toLowerCase().trim()] = item.id;
          if (item[codeKey]) m[item[codeKey].toLowerCase().trim()] = item.id;
        }
      });
      return m;
    };

    const maps = {
      catMap: createMap(cats, 'code'),
      modelMap: createMap(models, 'code'),
    };

    setExistingClients(clients || []);
    setLookupMaps(maps);
    return { existingClients: clients || [], ...maps };
  };

  const handleFocus = async () => {
    if (existingClients) return;
    setImporting(true);
    try { await loadContext(); } catch (err) { console.error(err); } finally { setImporting(false); }
  };

  // Soft match: name similarity > 88%
  const isSoftMatch = (row, existing) => {
    const rowName = normalizeValue(row['Client Name'] || row.name || '');
    const extName = normalizeValue(existing.name);
    return calculateSimilarity(rowName, extName) > 0.88;
  };

  // Hard match: exact email or phone
  const isHardMatch = (row, existing) => {
    const rowEmail = (row['PoC Email'] || row.poc_email || '').toLowerCase().trim();
    const rowPhone = normalizeValue(row['PoC Phone'] || row.poc_phone || '');
    const extEmail = (existing.poc_email || '').toLowerCase().trim();
    const extPhone = normalizeValue(existing.poc_phone || '');
    if (rowEmail && extEmail && rowEmail === extEmail) return true;
    if (rowPhone && extPhone && rowPhone === extPhone) return true;
    return false;
  };

  const renderConflictTile = (conflict) => (
    <div className="tile-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h5 style={{ margin: 0, fontWeight: 600, color: 'var(--brand-green)' }}>
          {conflict.csvRow['Client Name'] || conflict.csvRow.name}
        </h5>
        {conflict.matchMode === 'hard' && (
          <span style={{ fontSize: '0.6rem', padding: '2px 6px', background: 'rgba(255,68,68,0.1)', color: '#ff4444', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 800 }}>
            Exact Match
          </span>
        )}
      </div>
      <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0 }}>{conflict.csvRow['PoC Email'] || conflict.csvRow.poc_email}</p>
      <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0 }}>{conflict.csvRow['PoC Phone'] || conflict.csvRow.poc_phone || 'No Phone'}</p>
    </div>
  );

  const handleDataParsed = async (rows) => {
    setImporting(true);
    try {
      const ctx = await loadContext();
      const lookup = (val, map) => val ? (map[val.toString().toLowerCase().trim()] || null) : null;

      const clientsToInsert = rows
        .filter(row => (row['Client Name'] || row.name || '').trim())
        .map(row => {
          const name = (row['Client Name'] || row.name || '').trim();
          const possibleMatches = ctx.existingClients.filter(e => isHardMatch(row, e) || isSoftMatch(row, e));
          const existingMatch = possibleMatches.find(e => isHardMatch(row, e)) || possibleMatches[0];

          return {
            id: existingMatch?.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
            name,
            category_id: lookup(row['Category'], ctx.catMap),
            billing_model_id: lookup(row['Billing Model'], ctx.modelMap),
            poc_name: row['PoC Name'] || row.poc_name || null,
            poc_phone: row['PoC Phone'] || row.poc_phone || null,
            poc_email: row['PoC Email'] || row.poc_email || null,
            status: row['Status'] || 'Active',
            updated_at: new Date().toISOString(),
          };
        });

      if (clientsToInsert.length === 0) throw new Error('No valid client records found.');

      const { error } = await supabase
        .from('clients')
        .upsert(clientsToInsert, { onConflict: 'id' });

      if (error) throw error;

      alert(`Successfully processed ${clientsToInsert.length} clients.`);
      setExistingClients(null); // Reset for next import
      if (onImportComplete) onImportComplete();
    } catch (err) {
      console.error('ClientCSVImport: Finalize Error:', err);
      alert(`Import failed: ${err.message || String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <CSVImportButton
      label={importing ? 'Importing...' : label}
      onDataParsed={handleDataParsed}
      requiredFields={['Client Name']}
      getConflictKey={(row) => {
        const name = normalizeValue(row['Client Name'] || row.name || '');
        const email = normalizeValue(row['PoC Email'] || row.poc_email || '');
        return `${name}|${email}` || 'new-row';
      }}
      findConflict={(row, existingData) => {
        const hard = existingData.find(e => isHardMatch(row, e));
        if (hard) return { existingRecord: hard, matchMode: 'hard' };
        const soft = existingData.find(e => isSoftMatch(row, e));
        if (soft) return { existingRecord: soft, matchMode: 'soft' };
        return null;
      }}
      existingData={existingClients}
      renderConflictTile={renderConflictTile}
      entityName="Clients"
      className={className}
      disabled={importing}
      compareFields={[
        { key: 'name', label: 'Client Name' },
        { key: 'poc_email', label: 'PoC Email' },
        { key: 'poc_phone', label: 'PoC Phone' },
        { key: 'category_code', label: 'Category' },
        { key: 'billing_model_code', label: 'Billing Model' },
      ]}
      onFocus={handleFocus}
    />
  );
};

export default ClientCSVImport;
