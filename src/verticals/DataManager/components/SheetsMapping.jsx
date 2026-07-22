import React from 'react';

const SheetsMapping = ({ tabSettings, onSettingChange }) => {
  return (
    <div className="dm-card">
      <div className="u-mb-24">
        <h3 className="u-text-brand-green u-fw-800 u-mb-8 u-text-1-1em">Configure Sheets Mapping</h3>
        <p className="u-text-sm u-opacity-70 u-m-0">
          Define the specific tab mappings for validation and historical storage.
        </p>
      </div>
      
      <div className="form-row-grid">
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
