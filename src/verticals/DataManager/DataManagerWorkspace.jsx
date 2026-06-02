import React, { useState, useEffect } from 'react';
import { googleSheetsService } from '../../services/core/googleSheetsService';

const DataManagerWorkspace = () => {
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [previewData, setPreviewData] = useState(null);

  const extractSpreadsheetId = (url) => {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  // Fetch spreadsheet structure and list of tabs, then load default tab
  const handleLoadSpreadsheet = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPreviewData(null);
    setTabs([]);
    setActiveTab('');

    try {
      const sheetId = extractSpreadsheetId(googleSheetsUrl);
      if (!sheetId) {
        throw new Error('Invalid Google Sheets URL. Make sure it contains a /d/SPREADSHEET_ID/ pattern.');
      }
      
      // 1. Get spreadsheet metadata to discover all tabs
      const metadata = await googleSheetsService.getSpreadsheet(sheetId);
      const sheetList = metadata.sheets || [];
      if (sheetList.length === 0) {
        throw new Error('No sheets or tabs found inside this spreadsheet.');
      }

      const tabNames = sheetList.map(s => s.properties.title);
      setTabs(tabNames);

      // Determine default tab (first available tab)
      const defaultTab = tabNames[0];
      setActiveTab(defaultTab);
      
      // 2. Fetch data for default tab
      const data = await googleSheetsService.readSheet(sheetId, defaultTab);
      setPreviewData(data);
    } catch (err) {
      console.error('[DataManager] Load error:', err);
      setError(err.message || 'Failed to connect to Google Sheet. Check permissions and Service Account access.');
    } finally {
      setLoading(false);
    }
  };

  // Dynamically load a different tab on click
  const handleTabChange = async (tabName) => {
    if (tabName === activeTab) return;
    setTabLoading(true);
    setError(null);
    setActiveTab(tabName);

    try {
      const sheetId = extractSpreadsheetId(googleSheetsUrl);
      const data = await googleSheetsService.readSheet(sheetId, tabName);
      setPreviewData(data);
    } catch (err) {
      console.error('[DataManager] Tab read error:', err);
      setError(`Failed to read tab "${tabName}": ${err.message}`);
      setPreviewData(null);
    } finally {
      setTabLoading(false);
    }
  };

  return (
    <div className="workspace-scroll-area">
      <div className="workspace-container" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Form Section */}
        <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ color: 'var(--brand-mint)', textShadow: '0 0 10px var(--halo-glow)' }}>Data Sheet Viewer</h2>
            <p style={{ color: 'var(--text-color)', opacity: 0.7 }}>Load and browse all tabs of a shared Google Sheet in real-time.</p>
          </div>
          
          <form onSubmit={handleLoadSpreadsheet} className="data-sheet-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div className="form-group">
              <label>Google Sheets URL</label>
              <div className="form-input-container">
                <input 
                  type="url" 
                  name="googleSheetsUrl"
                  value={googleSheetsUrl}
                  onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  required
                />
              </div>
            </div>

            <div className="form-footer" style={{ border: 'none', background: 'transparent', padding: '10px 0' }}>
              <button 
                type="submit" 
                className="halo-button primary"
                style={{ width: '100%' }}
                disabled={loading || !googleSheetsUrl}
              >
                {loading ? 'Connecting & Loading Spreadsheet...' : 'Load & Preview Spreadsheet'}
              </button>
            </div>
          </form>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <div className="spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid var(--brand-mint)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
            <p style={{ color: 'var(--text-color)' }}>Retrieving spreadsheet architecture and reading tabs...</p>
            <style>{`
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', color: '#f87171' }}>
            <strong>Error Loading Spreadsheet:</strong>
            <p style={{ margin: '8px 0 0', fontSize: '14px', lineHeight: '1.5' }}>{error}</p>
          </div>
        )}

        {/* Multi-Tab Data Preview Section */}
        {tabs.length > 0 && (
          <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Sheet Tab Bar */}
            <div>
              <h3 style={{ color: 'var(--brand-mint)', margin: '0 0 12px 0' }}>Available Sheet Tabs</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                {tabs.map((tab) => {
                  const isActive = tab === activeTab;
                  return (
                    <button
                      key={tab}
                      onClick={() => handleTabChange(tab)}
                      className={`halo-button ${isActive ? 'primary' : ''}`}
                      style={{ 
                        padding: '6px 16px', 
                        fontSize: '13px', 
                        height: 'auto',
                        background: isActive ? 'var(--brand-mint)' : 'rgba(255,255,255,0.05)',
                        borderColor: isActive ? 'var(--brand-mint)' : 'var(--border-color)',
                        color: isActive ? '#000' : 'var(--text-color)'
                      }}
                      disabled={tabLoading}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Table or Inner Loading State */}
            {tabLoading ? (
              <div style={{ textAlign: 'center', padding: '60px' }}>
                <div className="spinner" style={{ border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid var(--brand-mint)', borderRadius: '50%', width: '32px', height: '32px', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }}></div>
                <p style={{ color: 'var(--text-color)', fontSize: '14px', opacity: 0.8 }}>Reading rows from "{activeTab}"...</p>
              </div>
            ) : previewData ? (
              <div>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ color: 'var(--text-color)', opacity: 0.6, margin: 0, fontSize: '13px' }}>
                    Showing first 20 rows of {previewData.length} records detected in <strong>{activeTab}</strong>.
                  </p>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '400px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '2px solid var(--border-color)' }}>
                        {previewData[0]?.map((cell, idx) => (
                          <th key={idx} style={{ padding: '12px 16px', color: 'var(--brand-mint)', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            {cell || `Col ${idx + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(1, 21).map((row, rowIdx) => (
                        <tr 
                          key={rowIdx} 
                          style={{ 
                            borderBottom: '1px solid var(--border-color)', 
                            background: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                        >
                          {previewData[0]?.map((_, colIdx) => (
                            <td key={colIdx} style={{ padding: '12px 16px', color: 'var(--text-color)', opacity: 0.85, whiteSpace: 'nowrap' }}>
                              {row[colIdx] !== undefined ? String(row[colIdx]) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-color)', opacity: 0.6 }}>
                No preview data loaded for tab "{activeTab}"
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};

export default DataManagerWorkspace;
