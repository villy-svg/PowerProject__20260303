import React from 'react';

const SheetsMapping = ({ tabSettings, onSettingChange }) => {
  return (
    <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: 'var(--brand-mint)', margin: 0 }}>Configure Sheets Mapping</h3>
        <p style={{ color: 'var(--text-color)', opacity: 0.6, fontSize: '13px', margin: '4px 0 0' }}>
          Define the specific tab mappings for validation and historical storage.
        </p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label>Current Data Tab Name</label>
          <div className="form-input-container">
            <input 
              type="text" 
              name="currentDataTab"
              value={tabSettings.currentDataTab}
              onChange={onSettingChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Vehicle Details Tab Name</label>
          <div className="form-input-container">
            <input 
              type="text" 
              name="vehicleDetailsTab"
              value={tabSettings.vehicleDetailsTab}
              onChange={onSettingChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Master Data Tab Name</label>
          <div className="form-input-container">
            <input 
              type="text" 
              name="masterDataTab"
              value={tabSettings.masterDataTab}
              onChange={onSettingChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Metadata / Header Rows to Skip</label>
          <div className="form-input-container">
            <input 
              type="number" 
              name="headerRowsToSkip"
              min="0"
              value={tabSettings.headerRowsToSkip}
              onChange={onSettingChange}
              required
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SheetsMapping;
