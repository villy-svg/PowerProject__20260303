import React from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/supabaseClient';

/**
 * HubCSVImport — Thin Wrapper
 *
 * Defines hub-specific import rules:
 *   - Conflict key: hub_code
 *   - Upsert on hub_code for DB conflict resolution
 *
 * All duplicate detection (in-file + DB) is handled by CSVImportButton.
 */
const HubCSVImport = ({ onImportComplete, className }) => {
  const [existingHubs, setExistingHubs] = React.useState(null);

  const loadExistingHubs = async () => {
    if (existingHubs) return existingHubs;
    const { data, error } = await supabase.from('hubs').select('id, name, hub_code');
    if (error) throw error;
    setExistingHubs(data || []);
    return data || [];
  };

  const handleFocus = async () => {
    try { await loadExistingHubs(); } catch (err) { console.error(err); }
  };

  // Uniqueness: hub_code
  const getConflictKey = (row) => (row.hub_code || '').toLowerCase().trim();

  const renderConflictTile = (conflict) => (
    <div className="tile-content">
      <h5 style={{ margin: '0 0 4px 0', fontWeight: 800, color: 'var(--brand-green)' }}>
        {conflict.csvRow.name}
      </h5>
      <div style={{ fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.4 }}>
        <strong>Code:</strong> {conflict.csvRow.hub_code}<br />
        <strong>New City:</strong> {conflict.csvRow.city || 'N/A'}<br />
        <em style={{ fontSize: '0.7rem' }}>Existing: {conflict.existingRecord.name}</em>
      </div>
    </div>
  );

  const handleDataParsed = async (rows) => {
    try {
      const rowsToInsert = rows.map(row => ({
        name: row.name,
        hub_code: row.hub_code || null,
        city: row.city || null,
        status: row.status || 'inactive',
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('hubs')
        .upsert(rowsToInsert, { onConflict: 'hub_code' });

      if (error) throw error;
      alert(`Successfully processed ${rowsToInsert.length} hubs.`);
      setExistingHubs(null); // Reset for next import
      if (onImportComplete) onImportComplete();
    } catch (err) {
      console.error('Finalize Error:', err);
      alert(`Error importing hubs: ${err.message}`);
    }
  };

  return (
    <CSVImportButton
      label="Import CSV"
      onDataParsed={handleDataParsed}
      requiredFields={['name']}
      getConflictKey={getConflictKey}
      existingData={existingHubs}
      renderConflictTile={renderConflictTile}
      entityName="Hubs"
      className={className}
      onFocus={handleFocus}
    />
  );
};

export default HubCSVImport;
