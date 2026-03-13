import React, { useState } from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/supabaseClient';
import CSVConflictModal from '../../components/CSVConflictModal';

const HubCSVImport = ({ onImportComplete, className }) => {
  const [showConflicts, setShowConflicts] = useState(false);
  const [pendingData, setPendingData] = useState({
    conflicts: [],
    nonConflictingRows: []
  });

  const handleDataParsed = async (validRows, skippedCount) => {
    const { data: existingHubs, error: fetchError } = await supabase
      .from('hubs')
      .select('id, name, hub_code');

    if (fetchError) {
      alert(`Error checking duplicates: ${fetchError.message}`);
      return;
    }

    const conflicts = [];
    const nonConflictingRows = [];

    validRows.forEach(row => {
      const existing = existingHubs.find(h => h.hub_code && h.hub_code === row.hub_code);
      if (existing) {
        conflicts.push({ csvRow: row, existingHub: existing });
      } else {
        nonConflictingRows.push(row);
      }
    });

    if (conflicts.length > 0) {
      setPendingData({ conflicts, nonConflictingRows });
      setShowConflicts(true);
    } else {
      await finalizeImport(validRows, skippedCount);
    }
  };

  const handleResolveConflicts = async (selectedCsvRowsToUpdate) => {
    setShowConflicts(false);
    
    const finalDataToProcess = [
      ...pendingData.nonConflictingRows,
      ...selectedCsvRowsToUpdate
    ];

    if (finalDataToProcess.length === 0) return;
    await finalizeImport(finalDataToProcess, 0);
  };

  const finalizeImport = async (rows, skippedCount) => {
    const rowsToInsert = rows.map(row => ({
      name: row.name,
      hub_code: row.hub_code || null,
      location: row.location || null,
      status: row.status || 'inactive',
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('hubs')
      .upsert(rowsToInsert, { onConflict: 'hub_code' });
    
    if (error) {
      alert(`Error importing hubs: ${error.message}`);
    } else {
      let msg = `Successfully processed ${rowsToInsert.length} hubs.`;
      if (skippedCount > 0) msg += `\n(Skipped ${skippedCount} invalid rows)`;
      alert(msg);
      
      if (onImportComplete) {
        onImportComplete();
      }
    }
  };

  // Specific Hub tile renderer for the conflict modal
  const renderHubConflictTile = (conflict) => (
    <div className="tile-content">
      <h5 style={{ margin: '0 0 4px 0', fontWeight: 800, color: 'var(--brand-green)' }}>
        {conflict.csvRow.name}
      </h5>
      <div style={{ fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.4 }}>
        <strong>Code:</strong> {conflict.csvRow.hub_code}<br/>
        <strong>New Loc:</strong> {conflict.csvRow.location || 'N/A'}<br/>
        <em style={{fontSize: '0.7rem'}}>Existing: {conflict.existingHub.name}</em>
      </div>
    </div>
  );

  return (
    <>
      <CSVImportButton
        onDataParsed={handleDataParsed}
        requiredFields={['name']}
        label="Import CSV"
        className={className}
      />

      {showConflicts && (
        <CSVConflictModal 
          entityName="Hubs"
          conflicts={pendingData.conflicts}
          onResolve={handleResolveConflicts}
          onCancel={() => setShowConflicts(false)}
          renderConflictTile={renderHubConflictTile}
        />
      )}
    </>
  );
};

export default HubCSVImport;
