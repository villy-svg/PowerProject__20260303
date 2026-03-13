import React, { useState } from 'react';
import CSVImportButton from '../../components/CSVImportButton';
import { supabase } from '../../services/supabaseClient';
import CSVConflictModal from '../../components/CSVConflictModal';

const FunctionCSVImport = ({ onImportComplete, className }) => {
  const [showConflicts, setShowConflicts] = useState(false);
  const [pendingData, setPendingData] = useState({
    conflicts: [],
    nonConflictingRows: []
  });

  const handleDataParsed = async (validRows, skippedCount) => {
    const { data: existingFns, error: fetchError } = await supabase
      .from('hub_functions')
      .select('id, name');

    if (fetchError) {
      alert(`Error checking duplicates: ${fetchError.message}`);
      return;
    }

    const conflicts = [];
    const nonConflictingRows = [];

    validRows.forEach(row => {
      const existing = existingFns.find(f => f.name.toLowerCase() === row.name.toLowerCase());
      if (existing) {
        conflicts.push({ csvRow: row, existingFn: existing });
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
      function_code: row.function_code || null,
      description: row.description || null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('hub_functions')
      .upsert(rowsToInsert, { onConflict: 'name' });
    
    if (error) {
      alert(`Error importing functions: ${error.message}`);
    } else {
      let msg = `Successfully processed ${rowsToInsert.length} functional categories.`;
      if (skippedCount > 0) msg += `\n(Skipped ${skippedCount} invalid rows)`;
      alert(msg);
      
      if (onImportComplete) {
        onImportComplete();
      }
    }
  };

  const renderConflictTile = (conflict) => (
    <div className="tile-content">
      <h5 style={{ margin: '0 0 4px 0', fontWeight: 800, color: 'var(--brand-green)' }}>
        {conflict.csvRow.name}
      </h5>
      <div style={{ fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.4 }}>
        <strong>New Desc:</strong> {conflict.csvRow.description || 'N/A'}<br/>
        <em style={{fontSize: '0.7rem'}}>Status: Will overwrite existing entry</em>
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
          entityName="Functions"
          conflicts={pendingData.conflicts}
          onResolve={handleResolveConflicts}
          onCancel={() => setShowConflicts(false)}
          renderConflictTile={renderConflictTile}
        />
      )}
    </>
  );
};

export default FunctionCSVImport;
