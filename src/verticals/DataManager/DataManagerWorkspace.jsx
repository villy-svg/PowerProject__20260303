import React, { useState } from 'react';

const DataManagerWorkspace = () => {
  const [formData, setFormData] = useState({
    googleSheetsUrl: '',
    customerName: '',
    newDataSheetName: '',
    vehicleDetailsSheetName: 'Vehicle Details'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form Submitted:', formData);
    // Submit logic will go here
  };

  return (
    <div className="workspace-scroll-area">
      <div className="workspace-container" style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2>Data Sheet Form</h2>
          <p style={{ color: 'var(--text-color)', opacity: 0.7 }}>Enter the details to configure the new data sheet.</p>
        </div>
        <form onSubmit={handleSubmit} className="data-sheet-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="form-group">
            <label>Google Sheets URL</label>
            <div className="form-input-container">
              <input 
                type="url" 
                name="googleSheetsUrl"
                value={formData.googleSheetsUrl}
                onChange={handleChange}
                placeholder="Enter Google Sheets URL"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Customer Name</label>
            <div className="form-input-container">
              <input 
                type="text" 
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                placeholder="Enter Customer Name"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>New Data Sheet Name</label>
            <div className="form-input-container">
              <input 
                type="text" 
                name="newDataSheetName"
                value={formData.newDataSheetName}
                onChange={handleChange}
                placeholder="Enter New Data Sheet Name"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Vehicle Details Sheet Name</label>
            <div className="form-input-container" style={{ opacity: 0.85 }}>
              <input 
                type="text" 
                name="vehicleDetailsSheetName"
                value={formData.vehicleDetailsSheetName}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-footer" style={{ border: 'none', background: 'transparent', padding: '10px 0' }}>
            <button 
              type="submit" 
              className="halo-button primary"
            >
              Submit Data Sheet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DataManagerWorkspace;
