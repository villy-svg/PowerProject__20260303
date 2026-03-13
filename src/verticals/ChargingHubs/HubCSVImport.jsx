import React from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/supabaseClient';

const HubCSVImport = ({ onImportComplete, className }) => {
  const handleDataParsed = async (validRows, skippedCount) => {
    // Map parsed keys to match database columns
    const rowsToInsert = validRows.map(row => ({
      name: row.name,
      location: row.location || null,
      status: row.status || 'inactive',
      updated_at: new Date().toISOString(),
    }));

    if (rowsToInsert.length === 0) return;

    const { error } = await supabase.from('hubs').insert(rowsToInsert);
    
    if (error) {
      alert(`Error importing hubs: ${error.message}`);
    } else {
      let msg = `Successfully imported ${rowsToInsert.length} hubs.`;
      if (skippedCount > 0) msg += `\n(Skipped ${skippedCount} invalid rows without names)`;
      alert(msg);
      
      if (onImportComplete) {
        onImportComplete();
      }
    }
  };

  return (
    <CSVImportButton
      onDataParsed={handleDataParsed}
      requiredFields={['name']} /* Hubs strictly require a name */
      label="Import CSV"
      className={className}
    />
  );
};

export default HubCSVImport;
