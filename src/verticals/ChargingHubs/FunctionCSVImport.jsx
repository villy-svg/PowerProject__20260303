import React from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/supabaseClient';

/**
 * FunctionCSVImport — Thin Wrapper
 *
 * Defines hub function-specific import rules:
 *   - Conflict key: name (case-insensitive)
 *   - Upserts on 'name' in hub_functions
 *
 * All duplicate detection (in-file + DB) is handled by CSVImportButton.
 */
const FunctionCSVImport = ({ onImportComplete, className, label = 'Import CSV' }) => {
  const [loading, setLoading] = React.useState(false);
  const [existingFns, setExistingFns] = React.useState(null);

  const handleFocus = async () => {
    if (existingFns) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('hub_functions').select('id, name');
      setExistingFns(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Uniqueness: function name (case-insensitive)
  const getConflictKey = (row) => (row.name || '').toLowerCase().trim();

  const renderConflictTile = (conflict) => (
    <div className="tile-content">
      <h5 style={{ margin: '0 0 4px 0', fontWeight: 800, color: 'var(--brand-green)' }}>
        {conflict.csvRow.name}
      </h5>
      <div style={{ fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.4 }}>
        <strong>New Desc:</strong> {conflict.csvRow.description || 'N/A'}<br />
        <em style={{ fontSize: '0.7rem' }}>Will overwrite existing entry</em>
      </div>
    </div>
  );

  const handleDataParsed = async (rows) => {
    try {
      const rowsToInsert = rows.map(row => ({
        name: row.name,
        function_code: row.function_code || null,
        description: row.description || null,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('hub_functions')
        .upsert(rowsToInsert, { onConflict: 'name' });

      if (error) throw error;
      alert(`Successfully processed ${rowsToInsert.length} functional categories.`);
      setExistingFns(null); // Reset for next import
      if (onImportComplete) onImportComplete();
    } catch (err) {
      console.error('Finalize Error:', err);
      alert(`Error importing functions: ${err.message}`);
    }
  };

  return (
    <CSVImportButton
      label={loading ? 'Loading...' : label}
      onDataParsed={handleDataParsed}
      requiredFields={['name']}
      getConflictKey={getConflictKey}
      existingData={existingFns}
      renderConflictTile={renderConflictTile}
      entityName="Functions"
      className={className}
      disabled={loading}
      onFocus={handleFocus}
    />
  );
};

export default FunctionCSVImport;
