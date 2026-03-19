import React from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/supabaseClient';
import { normalizeValue, calculateSimilarity } from '../../utils/matchingAlgorithms';

/**
 * ClientCategoryCSVImport — Thin Wrapper
 *
 * Defines client category specific import rules.
 */
const ClientCategoryCSVImport = ({ onImportComplete, className, label = 'Import Categories' }) => {
  const [importing, setImporting] = React.useState(false);
  const [existingCategories, setExistingCategories] = React.useState(null);

  const loadContext = async () => {
    if (existingCategories) return { existingCategories };

    const { data: categories, error } = await supabase
      .from('client_categories')
      .select('id, name, code');

    if (error) throw error;

    setExistingCategories(categories || []);
    return { existingCategories: categories || [] };
  };

  const handleFocus = async () => {
    if (existingCategories) return;
    setImporting(true);
    try { await loadContext(); } catch (err) { console.error(err); } finally { setImporting(false); }
  };

  // Soft match: name similarity > 92% (categories are usually short, so higher threshold)
  const isSoftMatch = (row, existing) => {
    const rowName = normalizeValue(row['Category Name'] || row.name || '');
    const extName = normalizeValue(existing.name);
    return calculateSimilarity(rowName, extName) > 0.92;
  };

  // Hard match: exact code
  const isHardMatch = (row, existing) => {
    const rowCode = (row['Code'] || row.code || '').toUpperCase().trim();
    const extCode = (existing.code || '').toUpperCase().trim();
    if (rowCode && extCode && rowCode === extCode) return true;
    return false;
  };

  const renderConflictTile = (conflict) => (
    <div className="tile-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h5 style={{ margin: 0, fontWeight: 600, color: 'var(--brand-green)' }}>
          {conflict.csvRow['Category Name'] || conflict.csvRow.name}
        </h5>
        {conflict.matchMode === 'hard' && (
          <span style={{ fontSize: '0.6rem', padding: '2px 6px', background: 'rgba(255,68,68,0.1)', color: '#ff4444', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 800 }}>
            Code Match
          </span>
        )}
      </div>
      <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0 }}>Code: {conflict.csvRow['Code'] || conflict.csvRow.code || 'None'}</p>
    </div>
  );

  const handleDataParsed = async (rows) => {
    setImporting(true);
    try {
      const ctx = await loadContext();

      const categoriesToUpsert = rows
        .filter(row => (row['Category Name'] || row.name || '').trim())
        .map(row => {
          const name = (row['Category Name'] || row.name || '').trim();
          const possibleMatches = ctx.existingCategories.filter(e => isHardMatch(row, e) || isSoftMatch(row, e));
          const existingMatch = possibleMatches.find(e => isHardMatch(row, e)) || possibleMatches[0];

          return {
            id: existingMatch?.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
            name,
            code: (row['Code'] || row.code || '').toUpperCase().trim() || null,
            description: row['Description'] || row.description || null,
            updated_at: new Date().toISOString(),
          };
        });

      if (categoriesToUpsert.length === 0) throw new Error('No valid category records found.');

      const { error } = await supabase
        .from('client_categories')
        .upsert(categoriesToUpsert, { onConflict: 'id' });

      if (error) throw error;

      alert(`Successfully processed ${categoriesToUpsert.length} categories.`);
      setExistingCategories(null); // Reset for next import
      if (onImportComplete) onImportComplete();
    } catch (err) {
      console.error('ClientCategoryCSVImport: Finalize Error:', err);
      alert(`Import failed: ${err.message || String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <CSVImportButton
      label={importing ? 'Importing...' : label}
      onDataParsed={handleDataParsed}
      requiredFields={['Category Name']}
      getConflictKey={(row) => {
        const name = normalizeValue(row['Category Name'] || row.name || '');
        const code = normalizeValue(row['Code'] || row.code || '');
        return `${name}|${code}` || 'new-row';
      }}
      findConflict={(row, existingData) => {
        const hard = existingData.find(e => isHardMatch(row, e));
        if (hard) return { existingRecord: hard, matchMode: 'hard' };
        const soft = existingData.find(e => isSoftMatch(row, e));
        if (soft) return { existingRecord: soft, matchMode: 'soft' };
        return null;
      }}
      existingData={existingCategories}
      renderConflictTile={renderConflictTile}
      entityName="Client Categories"
      className={className}
      disabled={importing}
      compareFields={[
        { key: 'name', label: 'Category Name' },
        { key: 'code', label: 'Code' },
        { key: 'description', label: 'Description' },
      ]}
      onFocus={handleFocus}
    />
  );
};

export default ClientCategoryCSVImport;
